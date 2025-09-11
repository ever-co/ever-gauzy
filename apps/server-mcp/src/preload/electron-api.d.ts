export type ElectronAPI = {
    getMcpStatus(): Promise<any>;
    restartMcpServer(): Promise<any>;
    onServerStatusUpdate(cb: (data?: any) => void): () => void;
    getAppVersion(): Promise<string>;
    getSavedTheme(): Promise<string>;
    saveTheme(theme: string): Promise<boolean>;
    expandWindow(): void;
};
