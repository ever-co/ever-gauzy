import { IProxyConfig } from '../../interfaces';
import { ProxyServer } from './proxy-server';

export class ApiProxyServer extends ProxyServer {
	private _proxyCfg: IProxyConfig;
	private _message: string;

	constructor(proxyCfg: IProxyConfig) {
		super();
		this._proxyCfg = proxyCfg;
		this._message = '';
	}

	public start(): void {
		this._proxyCfg.update(this._proxyCfg.forwardApiBaseUrl);
		this.port = this._proxyCfg.apiPort + 1;
		super.start();
		this.message = `[APIPROXY]: Proxy start and forward the request to the target IP (${this._proxyCfg.uiHostName}) address and port ${this.port}. ${this._proxyCfg.apiBaseUrl} -> ${this._proxyCfg.forwardApiBaseUrl} `;
	}

	public stop(): void {
		super.stop();
		this._proxyCfg.update(this._proxyCfg.apiBaseUrl);
		this.message = `[APIPROXY]: stop forward the api port ${this._proxyCfg.apiPort}`;
	}

	public get message(): string {
		return this._message;
	}

	public set message(value: string) {
		this._message = value;
	}
}
