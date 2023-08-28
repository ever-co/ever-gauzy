export type IServerSetting = { [key: string]: any };

export interface IServerConfig {
	get apiPort(): number;
	get uiPort(): number;
	get uiHostName(): string;
	get apiUrl(): string;
	get uiUrl(): string;
	update(): void;
	setting: IServerSetting;
}
