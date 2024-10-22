import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { __dirname } from '../dirname.js';

export const STATS_DIR = path.resolve(__dirname, '..', 'stats');
export const STATS_FILE = `stats.json`;

if (!fs.existsSync(STATS_DIR)) {
	fs.mkdirSync(STATS_DIR, { recursive: true });
}

export async function createFile() {
  const filePath = `${STATS_DIR}/${STATS_FILE}`;
  console.log("Creating file: " + filePath);
  try {
    await fsp.writeFile(filePath, "[]", { flag: "wx" });
  } catch (error: any) {
    if (error.code === 'EEXIST') {
      console.log("File already exists: " + filePath);
    } else {
      throw error;
    }
  }
}

const queues = new Map<string, (() => Promise<void>)[]>();
const processing = new Map<string, boolean>();

async function processQueue(filePath: string) {
  if (processing.get(filePath)) return;
  processing.set(filePath, true);

  const queue = queues.get(filePath) || [];
  while (queue.length > 0) {
    const task = queue.shift();
    if (task) {
      try {
        await task();
      } catch (error: any) {
        console.error('Error processing task for file ' + filePath + ': ' + error.message);
      }
    }
  }

  processing.set(filePath, false);
}

export async function saveStatsToFile(data: any) {
  const filePath = `${STATS_DIR}/${STATS_FILE}`;

  // Initialize queue for the file if it does not exist
  if (!queues.has(filePath)) {
    queues.set(filePath, []);
  }

  // Add task to the queue
  queues.get(filePath)!.push(() => saveStatsToFileAux(filePath, data));
  
  // Process the queue
  processQueue(filePath);
}

async function saveStatsToFileAux(filePath: string, data: any) {
  let fd: fsp.FileHandle | null = null;

  try {
    fd = await fsp.open(filePath, 'r+');

    const { size } = await fd.stat();
    let newData = JSON.stringify(data) + ']'; // Append the closing bracket

    if (size > 2) { // Check if the file is longer than `[]`
      const lastByteBuffer = Buffer.alloc(1);
      const { buffer } = await fd.read(lastByteBuffer, 0, 1, size - 1);

      if (buffer[0] === 93) {
        // Append comma if the file ends with ']'
        newData = ',' + newData;
        const buffer = Buffer.from(newData);
        await fd.write(buffer, 0, buffer.byteLength, size - 1);
      }
    } else {
      // If the file is just `[]`, we replace it with `[newData]`
      newData = '[' + newData;
      await fd.write(Buffer.from(newData), 0);
    }
  } catch (error: any) {
    console.error("Error saving stats to file: " + error.message);
    throw error;
  } finally {
    // Ensure resources are cleaned up
    if (fd) await fd.close();
  }
}