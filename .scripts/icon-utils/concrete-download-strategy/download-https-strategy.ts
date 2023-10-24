import { IDownloadStrategy } from '../interfaces/i-download-strategy';
import fetch from 'node-fetch';
import * as path from 'path';
import * as fs from 'fs';

export class DownloadHttpsStrategy implements IDownloadStrategy {
	public async download(
		imageUrl: string,
		destination: string
	): Promise<string> {
		if (!fs.existsSync(destination)) {
			fs.mkdirSync(destination);
			console.log('📁 - directory created!');
		}
		const response = await fetch(imageUrl);
		const buffer = await response.buffer();
		const fileName = path.basename(imageUrl);
		const filePath = path.join(destination, fileName);
		fs.writeFileSync(filePath, buffer);
		console.log(`⛓ - image ${fileName} downloaded successfully.`);
		return filePath;
	}
}
