import { IDownloadStrategy } from '../interfaces/i-download-strategy';
import * as fs from 'fs';
import { argv } from 'yargs';
import * as path from 'path';

export class DownloadAssetStrategy implements IDownloadStrategy {
	private readonly desktop = String(argv.desktop);

	private checkImageExistence(imagePath: string): boolean {
		try {
			fs.accessSync(imagePath);
			return true;
		} catch (error) {
			return false;
		}
	}

	public download(assetPath: string): Promise<string> | string {
		const filePath = path.join('apps', this.desktop, 'src', assetPath);
		if (this.checkImageExistence(filePath)) {
			return filePath;
		}
		console.warn(`WARNING️: This asset ${filePath} do not exist.`);
		return null;
	}
}
