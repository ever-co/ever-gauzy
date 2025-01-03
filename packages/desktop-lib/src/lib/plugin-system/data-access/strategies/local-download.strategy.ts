import * as logger from 'electron-log';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as unzipper from 'unzipper';
import { ILocalDownloadConfig, IPluginDownloadResponse, IPluginDownloadStrategy } from '../../shared';
import { LoadPluginDialog } from '../dialog/load-plugin.dialog';

export class LocalDownloadStrategy implements IPluginDownloadStrategy {
	/**
	 * Downloads a plugin from a local zip file and installs it in the
	 * user's data directory.
	 *
	 * @param config The configuration object for the download.
	 * @returns A promise that resolves to an object containing the path to
	 * the installed plugin and its metadata.
	 */
	async execute<T>(config: T): Promise<IPluginDownloadResponse> {
		const { pluginPath } = config as ILocalDownloadConfig;

		try {
			// Open a file dialog for the user to select a zip file
			const dialog = new LoadPluginDialog();

			// Save temporary zip and return path
			const zipFilePath = dialog.save();

			if (!zipFilePath) {
				throw new Error('No file selected');
			}

			const fileName = path.basename(zipFilePath);

			// Unzip the file to a temporary directory
			logger.info(`Unzipping file: ${zipFilePath}`);
			const tempDirPath = await this.unzip(zipFilePath, pluginPath);

			// Set Path Dirname
			const pluginDir = path.join(tempDirPath, fileName.replace(/\.zip$/, ''));

			// Read and parse the metadata
			logger.info('Reading manifest.json');
			const metadata = JSON.parse(
				await fs.readFile(path.join(pluginDir, 'manifest.json'), {
					encoding: 'utf8'
				})
			);
			logger.info(`✔ Manifest.json has been read and parsed: ${JSON.stringify(metadata)}`);

			// Rename the plugin directory to something unique
			const pathDirname = path.join(pluginPath, `${Date.now()}-${metadata.name}`);

			logger.info(`Renaming plugin directory to: ${pathDirname}`);
			await fs.rename(pluginDir, pathDirname);

			// Remove the downloaded zip file
			logger.info(`Removing downloaded .zip file: ${zipFilePath}`);
			await fs.rm(zipFilePath, { recursive: true, force: true, retryDelay: 1000, maxRetries: 3 });

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
