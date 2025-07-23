import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
	// MCP Server management
	getMcpStatus: () => ipcRenderer.invoke('get-mcp-status'),
	restartMcpServer: () => ipcRenderer.invoke('restart-mcp-server'),

	// App information
	getAppVersion: () => ipcRenderer.invoke('get-app-version'),

	// Theme management
	getSavedTheme: () => ipcRenderer.invoke('get-saved-theme'),
	saveTheme: (theme: string) => ipcRenderer.invoke('save-theme', theme),

	// Window management
	expandWindow: () => ipcRenderer.send('expand_window')
});

// Type definitions for TypeScript
declare global {
	interface Window {
		electronAPI: {
			getMcpStatus: () => Promise<{
				isRunning: boolean;
				message: string;
			}>;
			restartMcpServer: () => Promise<{
				success: boolean;
				message: string;
			}>;
			getAppVersion: () => Promise<string>;
			getSavedTheme: () => Promise<string>;
			saveTheme: (theme: string) => Promise<boolean>;
			expandWindow: () => void;
		};
	}
}
