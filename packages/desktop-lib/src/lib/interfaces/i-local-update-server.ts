export interface ILocalUpdateServer {
	start(): void;
	stop(): void;
	get running(): boolean;
}
