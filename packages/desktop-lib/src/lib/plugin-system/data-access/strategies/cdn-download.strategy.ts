import { createReadStream, createWriteStream } from 'fs';
import * as fs from 'fs/promises';
import fetch from 'node-fetch';
import * as path from 'path';
import * as unzipper from 'unzipper';
import { ICdnDownloadConfig, IPluginDownloadResponse, IPluginDownloadStrategy } from '../../shared';
import { logger } from '@gauzy/desktop-core';

export class CdnDownloadStrategy implements IPluginDownloadStrategy {
	private static readonly MAX_RETRIES = 3;
	private static readonly RETRY_DELAY_MS = 1000;
	private static readonly VALID_EXTENSION = '.zip';

	/**
	 * Downloads and installs a plugin from a CDN URL
	 * @param config Configuration for the download
	 * @returns Promise resolving to plugin location and metadata
	 * @throws Error if any step in the process fails
	 */
	async execute<T>(config: T): Promise<IPluginDownloadResponse> {
		const { url, pluginPath } = config as ICdnDownloadConfig;
		let zipFilePath: string | null = null;

		try {
			// Validate URL and extension
			this.validateUrl(url);

			// Prepare directories
			await this.prepareDirectory(pluginPath);

			// Download the file
			zipFilePath = await this.downloadPlugin(url, pluginPath);

			// Process the downloaded file
			return await this.processDownloadedFile(zipFilePath, pluginPath);
		} catch (error) {
			logger.error(`Plugin installation failed: ${error.message}`);
			await this.cleanupOnError(zipFilePath);
			throw error;
		}
	}

	private validateUrl(url: string): void {
		if (!url) {
			throw new Error('URL cannot be empty');
		}

		const ext = path.extname(url).toLowerCase();
		if (ext !== CdnDownloadStrategy.VALID_EXTENSION) {
			throw new Error(`URL must point to a ${CdnDownloadStrategy.VALID_EXTENSION} file`);
		}
	}

	private async prepareDirectory(dirPath: string): Promise<void> {
		try {
			await fs.mkdir(dirPath, { recursive: true });
			logger.info(`Directory prepared: ${dirPath}`);
		} catch (error) {
			throw new Error(`Failed to create directory: ${dirPath}`);
		}
	}

	private async downloadPlugin(url: string, downloadDir: string): Promise<string> {
		const fileName = path.basename(url);
		const zipFilePath = path.join(downloadDir, fileName);

		try {
			logger.info(`Starting download from: ${url}`);
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			if (!response.body) {
				throw new Error('No response body received');
			}

			// Stream the download directly to file
			const fileStream = createWriteStream(zipFilePath);
			await new Promise<void>((resolve, reject) => {
				response.body!.pipe(fileStream).on('finish', resolve).on('error', reject);
			});

			logger.info(`Download completed: ${zipFilePath}`);
			return zipFilePath;
		} catch (error) {
			throw new Error(`Download failed: ${error.message}`);
		}
	}

	private async processDownloadedFile(zipFilePath: string, pluginPath: string): Promise<IPluginDownloadResponse> {
		try {
			// Unzip the file
			const tempDirPath = await this.unzip(zipFilePath, pluginPath);

			// Find the plugin directory (handles different zip structures)
			const pluginDir = await this.findPluginDirectory(tempDirPath, path.basename(zipFilePath));

			if (!pluginDir) {
				throw new Error('Could not find plugin directory in the downloaded zip');
			}

			// Read and validate manifest
			const metadata = await this.readAndValidateManifest(pluginDir);

			// Create unique directory for plugin
			const pathDirname = await this.createUniquePluginDirectory(pluginPath, pluginDir, metadata.name);

			// Cleanup temporary files
			await this.cleanupZipFile(zipFilePath);

			return { pathDirname, metadata };
		} catch (error) {
			throw new Error(`File processing failed: ${error.message}`);
		}
	}

	private async findPluginDirectory(basePath: string, zipFileName: string): Promise<string | null> {
		try {
			// First try the expected path (filename without .zip)
			const expectedDir = path.join(basePath, zipFileName.replace(/\.zip$/i, ''));
			try {
				await fs.access(expectedDir);
				return expectedDir;
			} catch {
				// Expected path not found, search for manifest.json
				return await this.searchForManifest(basePath);
			}
		} catch (error) {
			logger.error(`Error finding plugin directory: ${error.message}`);
			return null;
		}
	}

	private async searchForManifest(startPath: string): Promise<string> {
		const manifestPaths = await this.findFiles(startPath, 'manifest.json', 3);

		if (manifestPaths.length === 0) {
			throw new Error('No manifest.json found in the unzipped directory');
		}

		// Use the first manifest found (closest to root)
		return path.dirname(manifestPaths[0]);
	}

	private async findFiles(dir: string, fileName: string, maxDepth: number): Promise<string[]> {
		const results: string[] = [];

		async function search(currentDir: string, depth: number) {
			if (depth > maxDepth) return;

			try {
				const files = await fs.readdir(currentDir);

				for (const file of files) {
					const fullPath = path.join(currentDir, file);
					const stat = await fs.stat(fullPath);

					if (stat.isDirectory()) {
						await search(fullPath, depth + 1);
					} else if (file === fileName) {
						results.push(fullPath);
					}
				}
			} catch (error) {
				logger.warn(`Error searching directory ${currentDir}: ${error.message}`);
			}
		}

		await search(dir, 0);
		return results;
	}

	private async unzip(filePath: string, extractDir: string): Promise<string> {
		try {
			await new Promise<void>((resolve, reject) => {
				createReadStream(filePath)
					.pipe(unzipper.Extract({ path: extractDir }))
					.on('close', resolve)
					.on('error', reject);
			});
			logger.info('File unzipped successfully');
			return extractDir;
		} catch (error) {
			throw new Error(`Unzip failed: ${error.message}`);
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

			logger.info(`Manifest validated: ${metadata.name}`);
			return metadata;
		} catch (error) {
			throw new Error(`Manifest error: ${error.message}`);
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
				retryDelay: CdnDownloadStrategy.RETRY_DELAY_MS,
				maxRetries: CdnDownloadStrategy.MAX_RETRIES
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
