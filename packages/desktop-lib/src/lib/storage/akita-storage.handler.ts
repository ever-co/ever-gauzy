import { AkitaStorageEngine } from '@gauzy/desktop-core';
import { ipcMain } from 'electron';

export class AkitaStorageHandler {
	constructor(private readonly engine: AkitaStorageEngine) {
		this.disposeHandlers();
		this.setupHandlers();
	}

	private setupHandlers(): void {
		ipcMain.handle('akita::storage::getItem', async (_, key) => {
			return this.engine.getItem(key);
		});

		ipcMain.handle('akita::storage::setItem', async (_, { key, value }) => {
			this.engine.setItem(key, value);
		});

		ipcMain.handle('akita::storage::removeItem', async (_, key) => {
			this.engine.removeItem(key);
		});

		ipcMain.handle('akita::storage::clear', async () => {
			this.engine.clear();
		});
	}

	private disposeHandlers(): void {
		ipcMain.removeHandler('akita::storage::getItem');
		ipcMain.removeHandler('akita::storage::setItem');
		ipcMain.removeHandler('akita::storage::removeItem');
		ipcMain.removeHandler('akita::storage::clear');
	}
}
