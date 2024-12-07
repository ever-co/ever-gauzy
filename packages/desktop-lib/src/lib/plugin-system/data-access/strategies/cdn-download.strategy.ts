import * as logger from 'electron-log';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import fetch from 'node-fetch';
import path, { join } from 'path';
import * as unzipper from 'unzipper';
import { ICdnDownloadConfig, IPluginDownloadResponse, IPluginDownloadStrategy } from '../../shared';

export class CdnDownloadStrategy implements IPluginDownloadStrategy {
	async execute<T>(config: T): Promise<IPluginDownloadResponse> {
		const { url, pluginPath } = config as ICdnDownloadConfig;

		try {
			// Ensure the temp directory exists
			await fs.mkdir(pluginPath, { recursive: true });
			logger.info(`✔ Temp directory verified/created -> ${pluginPath}`);

			// Fetch the file
			const response = await fetch(url);
			logger.info(`✔ Status code: ${response.status}`);
			if (!response.ok) {
				throw new Error(`Failed to download the file: ${response.statusText}`);
			}

			const buffer = await response.buffer();
			const fileName = path.basename(url);
			const ext = path.extname(url);
			const zipFilePath = path.join(pluginPath, fileName);

			if (ext !== '.zip') {
				throw new Error('The plugin should be inside a .zip file');
			}

			// Write the file to the temp directory
			await fs.writeFile(zipFilePath, buffer);
			logger.info(`✔ Plugin ${fileName} downloaded successfully`);

			// Unzip the file
			const tempDirPath = await this.unzip(zipFilePath, pluginPath);

			// Set Path Dirname
			const pluginDir = join(tempDirPath, fileName.replace(/\.zip$/, ''));

			// Read and parse the metadata
			const metadata = JSON.parse(
				await fs.readFile(join(pluginDir, 'manifest.json'), {
					encoding: 'utf8'
				})
			);
			logger.info(`✔ Manifest.json has been read and parsed: ${JSON.stringify(metadata)}`);

			// rename pathDirname
			const pathDirname = path.join(pluginPath, `${Date.now()}-${metadata.name}`);

			await fs.rename(pluginDir, pathDirname);
			logger.info(`✔ Plugin directory renamed to: ${pathDirname}`);

			// Remove downloaded .zip
			await fs.rm(zipFilePath, { recursive: true, force: true, retryDelay: 1000, maxRetries: 3 });
			logger.info(`✔ Downloaded .zip file has been removed`);

			return { pathDirname, metadata };
		} catch (error) {
			logger.error(`✖ Error during download and extraction: ${error.message}`);
			throw error;
		}
	}

	private async unzip(filePath: string, extractDir: string): Promise<string> {
		try {
			await new Promise<void>((resolve, reject) => {
				createReadStream(filePath)
					.pipe(unzipper.Extract({ path: extractDir }))
					.on('close', resolve)
					.on('error', reject);
			});
			logger.info('✔ File unzipped successfully');
			return extractDir;
		} catch (error) {
			logger.error(`✖ Error during unzip: ${error.message}`);
			throw error;
		}
	}
}
