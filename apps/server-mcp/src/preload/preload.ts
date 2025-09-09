// Import electron modules with error handling
let contextBridge: any, ipcRenderer: any;

console.log('Preload script starting...');
console.log('Process versions:', process.versions);
console.log('Environment:', { NODE_ENV: process.env.NODE_ENV, ELECTRON_IS_DEV: process.env.ELECTRON_IS_DEV });

try {
	const electron = require('electron');
	console.log('Preload: Electron object:', typeof electron, Object.keys(electron || {}));
	({ contextBridge, ipcRenderer } = electron);
	console.log('Preload: Electron modules loaded successfully');
	console.log('Preload: contextBridge available:', !!contextBridge);
	console.log('Preload: ipcRenderer available:', !!ipcRenderer);
} catch (error) {
	console.error('Preload: Failed to load electron modules:', error);
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
if (contextBridge && ipcRenderer) {
	try {
		console.log('Preload: About to expose electronAPI to main world...');
		const electronAPIObject = {
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
		};
		console.log('Preload: electronAPI object created:', Object.keys(electronAPIObject));
		contextBridge.exposeInMainWorld('electronAPI', electronAPIObject);
		console.log('Preload: electronAPI exposed successfully');
		
		// Verify exposure worked
		setTimeout(() => {
			try {
				console.log('Preload: Checking if window.electronAPI is available...');
				// Note: This check won't work in preload context, but helps with debugging
			} catch (e) {
				console.log('Preload: Cannot check window.electronAPI from preload context (expected)');
			}
		}, 100);
	} catch (error) {
		console.error('Preload: Failed to expose electronAPI:', error);
		console.error('Preload: Error details:', error.message, error.stack);
	}
} else {
	console.error('Preload: contextBridge or ipcRenderer not available');
	console.error('Preload: contextBridge:', typeof contextBridge, !!contextBridge);
	console.error('Preload: ipcRenderer:', typeof ipcRenderer, !!ipcRenderer);
}

// Type definitions for TypeScript (commented out to avoid module issues)
// declare global {
// 	interface Window {
// 		electronAPI: {
// 			getMcpStatus: () => Promise<{
// 				isRunning: boolean;
// 				message: string;
// 			}>;
// 			restartMcpServer: () => Promise<{
// 				success: boolean;
// 				message: string;
// 			}>;
// 			getAppVersion: () => Promise<string>;
// 			getSavedTheme: () => Promise<string>;
// 			saveTheme: (theme: string) => Promise<boolean>;
// 			expandWindow: () => void;
// 		};
// 	}
// }
