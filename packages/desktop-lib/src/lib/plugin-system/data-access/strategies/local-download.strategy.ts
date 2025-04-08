import { logger } from '@gauzy/desktop-core';
import { createReadStream } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as unzipper from 'unzipper';
import { ILocalDownloadConfig, IPluginDownloadResponse, IPluginDownloadStrategy } from '../../shared';
import { LoadPluginDialog } from '../dialog/load-plugin.dialog';

export class LocalDownloadStrategy implements IPluginDownloadStrategy {
	private static readonly MAX_RETRIES = 3;
	private static readonly RETRY_DELAY_MS = 1000;

	/**
	 * Downloads and installs a plugin from a local zip file
	 * @param config Configuration for the download
	 * @returns Promise resolving to plugin location and metadata
	 * @throws Error if any step in the process fails
	 */
	async execute<T>(config: T): Promise<IPluginDownloadResponse> {
		const { pluginPath } = config as ILocalDownloadConfig;
		let zipFilePath: string | null = null;

		try {
			zipFilePath = await this.getZipFilePathFromUser();
			await this.validateZipFile(zipFilePath);

			const fileName = path.basename(zipFilePath);
			const tempDirPath = await this.unzip(zipFilePath, pluginPath);
			const pluginDir = path.join(tempDirPath, fileName.replace(/\.zip$/i, ''));

			const metadata = await this.readAndValidateManifest(pluginDir);
			const pathDirname = await this.createUniquePluginDirectory(pluginPath, pluginDir, metadata.name);

			await this.cleanupZipFile(zipFilePath);

			return { pathDirname, metadata };
		} catch (error) {
			logger.error(`Plugin installation failed: ${error.message}`);

			// Cleanup any partially created files
			await this.cleanupOnError(zipFilePath);
			throw error;
		}
	}

	private async getZipFilePathFromUser(): Promise<string> {
		const dialog = new LoadPluginDialog();
		const zipFilePath = dialog.save();

		if (!zipFilePath) {
			throw new Error('No plugin zip file selected');
		}

		return zipFilePath;
	}

	private async validateZipFile(filePath: string): Promise<void> {
		try {
			await fs.access(filePath, fs.constants.R_OK);
		} catch (error) {
			throw new Error(`Zip file not accessible: ${filePath}`);
		}

		if (!filePath.toLowerCase().endsWith('.zip')) {
			throw new Error('Selected file is not a zip file');
		}
	}

	private async unzip(filePath: string, extractDir: string): Promise<string> {
		try {
			await fs.mkdir(extractDir, { recursive: true });

			await new Promise<void>((resolve, reject) => {
				createReadStream(filePath)
					.pipe(unzipper.Extract({ path: extractDir }))
					.on('close', resolve)
					.on('error', reject);
			});

			logger.info('File unzipped successfully');
			return extractDir;
		} catch (error) {
			throw new Error(`Failed to unzip file: ${error.message}`);
		}
	}

	private async readAndValidateManifest(pluginDir: string): Promise<any> {
		const manifestPath = path.join(pluginDir, 'manifest.json');

		try {
			const manifestContent = await fs.readFile(manifestPath, { encoding: 'utf8' });
			const metadata = JSON.parse(manifestContent);

			if (!metadata.name) {
				throw new Error('Manifest is missing required "name" field');
			}

			logger.info(`Manifest parsed successfully: ${metadata.name}`);
			return metadata;
		} catch (error) {
			throw new Error(`Invalid manifest file: ${error.message}`);
		}
	}

	private async createUniquePluginDirectory(
		basePath: string,
		sourceDir: string,
		pluginName: string
	): Promise<string> {
		const pathDirname = path.join(basePath, `${Date.now()}-${pluginName}`);

		try {
			await fs.rename(sourceDir, pathDirname);
			logger.info(`Plugin directory created: ${pathDirname}`);
			return pathDirname;
		} catch (error) {
			throw new Error(`Failed to create plugin directory: ${error.message}`);
		}
	}

	private async cleanupZipFile(zipFilePath: string): Promise<void> {
		try {
			await fs.rm(zipFilePath, {
				recursive: true,
				force: true,
				retryDelay: LocalDownloadStrategy.RETRY_DELAY_MS,
				maxRetries: LocalDownloadStrategy.MAX_RETRIES
			});
			logger.info(`Removed zip file: ${zipFilePath}`);
		} catch (error) {
			logger.warn(`Failed to remove zip file: ${zipFilePath}`);
			// Non-critical error, continue
		}
	}

	private async cleanupOnError(zipFilePath: string | null): Promise<void> {
		try {
			if (zipFilePath) {
				await this.cleanupZipFile(zipFilePath);
			}
		} catch (cleanupError) {
			logger.warn(`Cleanup failed: ${cleanupError.message}`);
		}
	}
}
