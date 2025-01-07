export interface loggable {
	logger: ILogger;
}

export interface ILogger {
	setup(): void;
	debug(...message: any[]): void;
	info(...message: any[]): void;
	warn(...message: any[]): void;
	error(...message: any[]): void;
}
