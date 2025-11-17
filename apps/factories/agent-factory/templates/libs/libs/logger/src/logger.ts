import type { Logger } from "./types";

export const log: Logger = { error, info, success, warn };

function success(message: string, ...args: unknown[]): void {
	console.log(`\x1b[32m[${getTimestamp()}] √ ${message}\x1b[0m`, ...args);
}

function info(message: string, ...args: unknown[]): void {
	console.log(`\x1b[36m[${getTimestamp()}] i ${message}\x1b[0m`, ...args);
}

function warn(message: string, ...args: unknown[]): void {
	console.warn(`\x1b[33m[${getTimestamp()}] ! ${message}\x1b[0m`, ...args);
}

function error(message: string, ...args: unknown[]): void {
	console.error(`\x1b[31m[${getTimestamp()}] × ${message}\x1b[0m`, ...args);
}

function getTimestamp(): string {
	return new Date().toISOString();
}
