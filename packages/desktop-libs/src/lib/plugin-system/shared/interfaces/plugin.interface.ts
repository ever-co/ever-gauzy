export interface IPlugin {
	name: string;
	version: string;
	initialize(): void;
	dispose(): void;
	activate(): void;
	deactivate(): void;
	component?(): void;
}
