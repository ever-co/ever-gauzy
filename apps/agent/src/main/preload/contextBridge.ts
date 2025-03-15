import { contextBridge, ipcRenderer, shell } from 'electron';
import * as remote from '@electron/remote';
import ElectronLog from 'electron-log';

contextBridge.exposeInMainWorld('electronAPI', {
	ipcRenderer: {
		send: (channel: string, data?: any) => ipcRenderer.send(channel, data),
		invoke: (channel: string, data?: any) => ipcRenderer.invoke(channel, data),
		on: (channel: string, callback: (event: Electron.IpcRendererEvent, ...args: any[]) => void) => {
			ipcRenderer.on(channel, (event, ...args) => callback(event, ...args));
		},
		removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
	},
	getGlobal: () => remote.getGlobal('variableGlobal'),
	shell: shell,
	remote: {
		app: {
			getLocale: () => remote.app.getLocale(),
			getName: () => remote.app.getName(),
			getVersion: () => remote.app.getVersion()
		}
	},
	log: ElectronLog
});

