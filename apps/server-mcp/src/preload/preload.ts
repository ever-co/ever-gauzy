import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
	// App methods
	getAppVersion: () => ipcRenderer.invoke('get-app-version'),

	// Theme methods
	getSavedTheme: () => ipcRenderer.invoke('get-saved-theme'),
	saveTheme: (theme: string) => ipcRenderer.invoke('save-theme', theme),

	// MCP Server methods
	getMcpServerStatus: () => ipcRenderer.invoke('get-mcp-server-status'),
	startMcpServer: () => ipcRenderer.invoke('start-mcp-server'),
	stopMcpServer: () => ipcRenderer.invoke('stop-mcp-server'),
	restartMcpServer: () => ipcRenderer.invoke('restart-mcp-server'),

	// Event listeners
	onShowMcpStatus: (callback: () => void) => {
		ipcRenderer.on('show-mcp-status', callback);
		return () => ipcRenderer.removeListener('show-mcp-status', callback);
	}
});

// Types for the exposed API
declare global {
	interface Window {
		electronAPI: {
			getAppVersion: () => Promise<string>;
			getSavedTheme: () => Promise<string>;
			saveTheme: (theme: string) => Promise<boolean>;
			getMcpServerStatus: () => Promise<{
				running: boolean;
				port: number | null;
				version: string | null;
				uptime?: number;
				lastError?: string;
			}>;
			startMcpServer: () => Promise<boolean>;
			stopMcpServer: () => Promise<boolean>;
			restartMcpServer: () => Promise<boolean>;
			onShowMcpStatus: (callback: () => void) => () => void;
		};
	}
}
