export interface IPlugin {
	name: string;
	version: string;
	initialize(): Promise<void> | void;
	dispose(): Promise<void> | void;
	activate(): Promise<void> | void;
	deactivate(): Promise<void> | void;
	component?(): void;
	menu?: Electron.MenuItemConstructorOptions;
}
