// Import electron modules with error handling
type MinimalContextBridge = { exposeInMainWorld: (key: string, api: unknown) => void };
type MinimalIpcRenderer = {
	invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
	on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void;
	removeListener: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void;
};
let contextBridge: MinimalContextBridge | undefined, ipcRenderer: MinimalIpcRenderer | undefined;

const __DEV__ =
	process.env.NODE_ENV !== 'production' ||
	process.env.ELECTRON_IS_DEV === '1' ||
	process.env.ELECTRON_IS_DEV === 'true';
	__DEV__ && console.log('Preload script starting...');
	__DEV__ && console.log('Process versions:', process.versions);
	__DEV__ && console.log('Environment:', { NODE_ENV: process.env.NODE_ENV, ELECTRON_IS_DEV: process.env.ELECTRON_IS_DEV });

try {
	const electron = require('electron');
	__DEV__ && console.log('Preload: Electron object:', typeof electron, Object.keys(electron || {}));
	if (electron) {
		({ contextBridge, ipcRenderer } = electron);
		__DEV__ && console.log('Preload: Electron modules loaded successfully');
		__DEV__ && console.log('Preload: contextBridge available:', !!contextBridge);
		__DEV__ && console.log('Preload: ipcRenderer available:', !!ipcRenderer);
	} else {
		console.error('Preload: Electron object is null or undefined');
	}
} catch (error) {
	console.error('Preload: Failed to load electron modules:', error);
}

// Timeout helper to prevent IPC calls from hanging indefinitely
const withTimeout = <T>(
	promise: Promise<T>,
	timeout = 5000,
	label = 'IPC call'
): Promise<T> => {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let timedOut = false;
	const timeoutP = new Promise<never>((_, reject) => {
		timer = setTimeout(() => {
			timedOut = true;
			reject(new Error(`${label} timed out after ${timeout}ms`));
		}, timeout);
	});
	return Promise.race([promise, timeoutP])
		.finally(() => { if (timer) clearTimeout(timer); })
		.catch((err) => {
		if (timedOut) {
			// prevent unhandled rejection if the original promise settles later
			promise.catch(() => {});
		}
	throw err;
	});
};

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
if (contextBridge && ipcRenderer) {
	try {
		__DEV__ && console.log('Preload: About to expose electronAPI to main world...');
		const electronAPIObject = {
			// MCP Server management
			getMcpStatus: async () => {
				__DEV__ && console.log('Preload: getMcpStatus called');
				try {
					const result = await withTimeout(ipcRenderer.invoke('get-mcp-status'), 500, 'get-mcp-status');
					__DEV__ && console.log('Preload: getMcpStatus result:', result);
					return result;
				} catch (error) {
					console.error('Preload: getMcpStatus error:', error);
					throw error;
				}
			},
			restartMcpServer: () => withTimeout(ipcRenderer.invoke('restart-mcp-server'), 15000, 'restart-mcp-server'),

			// Event subscriptions
			onServerStatusUpdate: (callback: (data?: any) => void) => {
				const listener = (_event: unknown, data?: any) => callback(data);
				ipcRenderer.on('server-status-update', listener);
				return () => ipcRenderer.removeListener('server-status-update', listener);
			},

			// Server readiness
			isServerReady: () => withTimeout(ipcRenderer.invoke('is-server-ready'), 3000, 'is-server-ready'),

			// App information
			getAppVersion: () => withTimeout(ipcRenderer.invoke('get-app-version'), 3000, 'get-app-version'),

			// Theme management
			getSavedTheme: () => withTimeout(ipcRenderer.invoke('get-saved-theme'), 3000, 'get-saved-theme'),
			saveTheme: (theme: string) => withTimeout(ipcRenderer.invoke('save-theme', theme)),

			// Window management
			expandWindow: () => withTimeout(ipcRenderer.invoke('expand-window'), 3000, 'expand-window')
		};
		__DEV__ && console.log('Preload: electronAPI object created:', Object.keys(electronAPIObject));
		const api = Object.freeze(electronAPIObject) as import('./electron-api').ElectronAPI;
	    contextBridge.exposeInMainWorld('electronAPI', api);
		__DEV__ && console.log('Preload: electronAPI exposed successfully');

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
		const err = error instanceof Error ? error : new Error(String(error));
		console.error('Preload: Failed to expose electronAPI:', err);
		console.error('Preload: Error details:', err.message, err.stack);
	}
} else {
	console.error('Preload: contextBridge or ipcRenderer not available');
	console.error('Preload: contextBridge:', typeof contextBridge, !!contextBridge);
	console.error('Preload: ipcRenderer:', typeof ipcRenderer, !!ipcRenderer);
}
