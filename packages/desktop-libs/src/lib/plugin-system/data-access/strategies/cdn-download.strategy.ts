import { app } from 'electron';
import * as fs from 'fs';
import fetch from 'node-fetch';
import path, { join } from 'path';
import * as unzipper from 'unzipper';
import { ICdnDownloadConfig, IPluginDownloadResponse, IPluginDownloadStrategy } from '../../shared';

export class CdnDownloadStrategy implements IPluginDownloadStrategy {
	async execute<T>(config: T): Promise<IPluginDownloadResponse> {
		const tempDir = join(app.getPath('userData'), 'temp');
		const { url } = config as ICdnDownloadConfig;

		try {
			// Ensure the temp directory exists
			fs.mkdirSync(tempDir, { recursive: true });
			console.log('✔ Temp directory verified/created');

			// Fetch the file
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to download the file: ${response.statusText}`);
			}

			const buffer = await response.buffer();
			const fileName = path.basename(url);
			const ext = path.extname(url);
			const zipFilePath = path.join(tempDir, fileName);

			if (ext !== 'zip') {
				throw new Error('The plugin should be inside a .zip file');
			}

			// Write the file to the temp directory
			fs.writeFileSync(zipFilePath, buffer);
			console.log(`✔ Plugin ${fileName} downloaded successfully`);

			// Unzip the file
			const tempDirPath = await this.unzip(zipFilePath);

			// Read and parse the metadata
			const metadata = JSON.parse(fs.readFileSync(join(tempDirPath, 'package.json'), { encoding: 'utf8' }));
			return { pathDirname: tempDirPath, metadata };
		} catch (error) {
			console.error(`✖ Error during download and extraction: ${error.message}`);
			throw error;
		}
	}

	private async unzip(filePath: string): Promise<string> {
		const extractDir = filePath.replace(/\.zip$/, '');
		try {
			fs.mkdirSync(extractDir, { recursive: true });
			await new Promise<void>((resolve, reject) => {
				fs.createReadStream(filePath)
					.pipe(unzipper.Extract({ path: extractDir }))
					.on('close', resolve)
					.on('error', reject);
			});
			console.log('✔ File unzipped successfully');
			return extractDir;
		} catch (error) {
			console.error(`✖ Error during unzip: ${error.message}`);
			throw error;
		}
	}
}
