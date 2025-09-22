export type ElectronAPI = {
	getMcpStatus(): Promise<unknown>; // or McpStatus
	restartMcpServer(): Promise<{ success: boolean; message: string }>;
	onServerStatusUpdate(cb: (data?: unknown) => void): () => void;
	isServerReady(): Promise<boolean>;
	getAppVersion(): Promise<string>;
	getSavedTheme(): Promise<string>;
	saveTheme(theme: string): Promise<boolean>;
	expandWindow(): Promise<boolean>;
};
