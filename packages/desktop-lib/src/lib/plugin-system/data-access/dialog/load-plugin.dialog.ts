import { BrowserWindow } from 'electron';
import { DialogOpenFile } from '../../../decorators';

export class LoadPluginDialog extends DialogOpenFile {
	constructor() {
		super(BrowserWindow.getFocusedWindow(), 'plugins');
		this._options.filters = [{ name: 'Plugin zip archive', extensions: ['zip'] }];
	}
}
