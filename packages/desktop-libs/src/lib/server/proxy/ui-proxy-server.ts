import { IProxyConfig } from '../../interfaces';
import { ProxyServer } from './proxy-server';

export class UiProxyServer extends ProxyServer {
	private _proxyCfg: IProxyConfig;
	private _message: string;
	constructor(proxyCfg: IProxyConfig) {
		super();
		this._proxyCfg = proxyCfg;
		this._message = '';
	}

	public start(): void {
		this.port = this._proxyCfg.uiPort + 1;
		super.start();
		this.message = `[UIPROXY]: Proxy start and forward the request to the target IP (${this._proxyCfg.uiHostName}) address and port ${this.port}. http://0.0.0.0:${this._proxyCfg.uiPort} -> ${this._proxyCfg.uiHostName}:${this.port} `;
	}

	public stop(): void {
		super.stop();
		this.message = `[UIPROXY]: stop forward port ${this._proxyCfg.uiPort}`;
	}

	public get message(): string {
		return this._message;
	}

	public set message(value: string) {
		this._message = value;
	}
}
