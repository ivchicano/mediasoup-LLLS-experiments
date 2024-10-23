import { format } from 'util';

const logger = (module: string) => ({
    info(...messages: any[]) {
        console.log(`[${new Date().toISOString()}] [${module}] [INFO]`, format(...messages));
    },
    error(...messages: any[]) {
        console.error(`[${new Date().toISOString()}] [${module}] [ERROR]`, format(...messages));
    },
    warn(...messages: any[]) {
        console.warn(`[${new Date().toISOString()}] [${module}] [WARN]`, format(...messages));
    }
});

export default logger;
