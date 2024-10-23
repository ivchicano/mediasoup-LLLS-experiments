import { ChildProcess, spawn, exec } from 'child_process';
import fs from 'fs';
import logger from '../logger.js';

const detachedPids: number[] = [];
const log = logger("RunScript");

export async function runScript(script: string, options?: {
    detached?: boolean,
    ignoreLogs?: boolean,
    redirectStdoutToFile?: string,
    stdoutCallback?: ((chunk: any) => void)
}): Promise<string | ChildProcess> {
    log.info(script);
    const promise: Promise<string | ChildProcess> = new Promise((resolve, reject) => {
        const execProcess = spawn(script, [], {
            cwd: `${process.cwd()}`,
            shell: "/bin/bash",
            detached: !!options ? !!options.detached ? options.detached : false : false,
            stdio: !!options ? !!options.ignoreLogs ? 'ignore' : 'pipe' : 'pipe',
            env: { ...process.env, DISPLAY: ':10' }
        });
        if (!!options && !!options.detached && options.detached) {
            if (execProcess.pid !== undefined) {
                detachedPids.push(execProcess.pid);
            }
            resolve(execProcess);
        } else {
            if (execProcess.stdout !== null) {
                if (!!options && !!options.redirectStdoutToFile) {
                    execProcess.stdout.pipe(fs.createWriteStream(options.redirectStdoutToFile));
                } else if (!!options && !!options.stdoutCallback) {
                    execProcess.stdout.on('data', options.stdoutCallback);
                } else {
                    execProcess.stdout.on('data', (data) => {
                        log.info(data.toString());
                    });
                }
            }
            if (execProcess.stderr !== null) {
                execProcess.stderr.on('data', (data) => {
                    log.info(data.toString());
                });
            }
            execProcess.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`exit code ${code}`);
                    return reject({
                        error: code
                    });
                } else {
                    return resolve("");
                }
            });
        }
    })
    return promise;
}

export function stopDetached(pid: number) {
    try {
        log.info("Stopping " + pid);
        process.kill(-pid, "SIGINT");
    } catch (err) {
        try {
            log.info("Retrying stopping " + pid);
            process.kill(pid, "SIGINT");
        } catch (err2) {
            console.error(err);
            console.error(err2);
        }
    }
}

export function killAllDetached() {
    log.info("PIDs to kill: " + detachedPids);
    detachedPids.forEach(pid => {
        try {
            log.info("Killing " + pid);
            process.kill(-pid);
        } catch (err) {
            try {
                log.info("Retrying killing " + pid);
                process.kill(pid);
            } catch (err2) {
                console.error(err);
                console.error(err2);
            }
        }
    });
}

export async function isRunning(query: string) {
    let cmd = `ps -Awwf`;
    return new Promise((resolve, reject) =>
        exec(cmd, (err, stdout, stderr) => {
            if (err) reject(err);
            const condition = stdout.toLowerCase().indexOf(query.toLowerCase()) > -1;
            resolve(condition);
        })
    );
}