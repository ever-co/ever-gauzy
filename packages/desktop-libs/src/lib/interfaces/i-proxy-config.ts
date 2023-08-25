export interface IProxyConfig {
	get apiPort(): number;
	get uiPort(): number;
	get forwardApiBaseUrl(): string;
	get uiHostName(): string;
	get apiBaseUrl(): string;
	update(url: string): void;
}
