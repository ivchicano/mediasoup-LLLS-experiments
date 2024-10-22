import type { Config } from './types/config-types.js'
import fs from 'fs';
import path from 'path';
import { __dirname } from './dirname.js';

const configPath = path.resolve(__dirname, '..', 'config.json');
const config: Config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

export default config;
