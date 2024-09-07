import { BrowserWindow, dialog, OpenDialogSyncOptions } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { DesktopDialog } from '../../desktop-dialog';
import { IDesktopSaveDialog } from '../../interfaces';
import { TranslateService } from '../../translation';
import { BaseDesktopDialogDecorator } from '../abstracts/base-desktop-dialog-decorator';

export class DialogOpenFile extends BaseDesktopDialogDecorator implements IDesktopSaveDialog {
	protected _options: OpenDialogSyncOptions;

	constructor(private readonly window: BrowserWindow, private readonly fileDestination = '') {
		super(
			new DesktopDialog(
				process.env.DESCRIPTION,
				TranslateService.instant('TIMER_TRACKER.DIALOG.SELECT_FILE'),
				window
			)
		);
		this._options = {
			properties: ['openFile'],
			filters: [{ name: 'SSL Key or SSL certificate', extensions: ['pem'] }],
			title: this.options.title,
			message: this.options.message
		};
	}

	public open(): string[] {
		return dialog.showOpenDialogSync(this.browserWindow, this._options);
	}

	public save(): string {
		try {
			const sources = this.open();
			if (!sources || sources.length === 0) {
				console.error('ERROR: No source file selected or invalid source format.');
				return null;
			}

			const source = sources[0];
			const fileName = path.basename(source);
			const destination = path.join(process.env.GAUZY_USER_PATH, this.fileDestination);

			try {
				fs.mkdirSync(destination, { recursive: true });
				console.log(`✔ Destination '${destination}' created.`);
			} catch (mkdirError) {
				if (mkdirError.code !== 'EEXIST') {
					console.error('ERROR: Unable to create destination directory:', mkdirError);
					return null;
				}
			}

			const destinationFile = path.join(destination, fileName);

			try {
				fs.copyFileSync(source, destinationFile);
				console.log(`✔ File '${fileName}' copied successfully to '${destination}'.`);
				return destinationFile;
			} catch (copyError) {
				console.error('ERROR: Unable to copy file:', copyError);
				return null;
			}
		} catch (error) {
			console.error('ERROR: File copy:', error);
			return null;
		}
	}
}
