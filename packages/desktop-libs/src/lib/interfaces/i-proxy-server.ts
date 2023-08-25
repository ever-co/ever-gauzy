import { ILocalServer } from './i-local-server';

export interface IProxyServer extends ILocalServer {
	onStop<T>(listener: () => T): void;
	onError<T>(listener: (error: string) => T): void;
	message?: string;
}
