import { logger } from '@gauzy/desktop-core';
import { createReadStream, createWriteStream } from 'fs';
import * as fs from 'fs/promises';
import { finished } from 'node:stream/promises';
import * as path from 'path';
import * as unzipper from 'unzipper';
import { ILocalDownloadConfig, IPluginDownloadResponse, IPluginDownloadStrategy } from '../../shared';
import { LoadPluginDialog } from '../dialog/load-plugin.dialog';

export class LocalDownloadStrategy implements IPluginDownloadStrategy {
	private static readonly MAX_RETRIES = 3;
	private static readonly RETRY_DELAY_MS = 1000;
	private static readonly MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB per file
	private static readonly MAX_TOTAL_SIZE = 1024 * 1024 * 1024; // 1GB total extraction limit
	private static readonly MANIFEST_FILENAME = 'manifest.json';

	/**
	 * Downloads and installs a plugin from a local zip file
	 * @param config Configuration for the download
	 * @returns Promise resolving to plugin location and metadata
	 * @throws Error if any step in the process fails
	 */
	async execute<T>(config: T): Promise<IPluginDownloadResponse> {
		const { pluginPath } = config as ILocalDownloadConfig;
		let zipFilePath: string | null = null;
		const tempExtractPath = path.join(pluginPath, `.temp-extract-${Date.now()}`);

		try {
			zipFilePath = await this.getZipFilePathFromUser();
			await this.validateZipFile(zipFilePath);

			await this.unzip(zipFilePath, tempExtractPath);

			const pluginDir = await this.findPluginDirectory(tempExtractPath, path.basename(zipFilePath));
			if (!pluginDir) {
				throw new Error('Could not find plugin directory in the selected zip');
			}

			const metadata = await this.readAndValidateManifest(pluginDir);
			const pathDirname = await this.createUniquePluginDirectory(pluginPath, pluginDir, metadata.name);

			await this.cleanupZipFile(zipFilePath);

			// Clean up temp extraction directory (plugin was already moved out)
			try {
				await fs.rm(tempExtractPath, { recursive: true, force: true });
			} catch (cleanupError) {
				logger.warn(`Failed to cleanup temp extraction directory: ${tempExtractPath}`);
			}

			return { pathDirname, metadata };
		} catch (error) {
			logger.error(`Plugin installation failed: ${error.message}`);

			// Cleanup any partially created files
			await this.cleanupOnError(zipFilePath, tempExtractPath);
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

	/**
	 * Validates that a file path is safe and doesn't attempt path traversal (Zip Slip prevention)
	 */
	private isSafePath(rootDir: string, entryPath: string): boolean {
		if (!entryPath) return false;

		const normalizedEntry = entryPath.replaceAll('\\', '/');

		// Reject Unix-style absolute paths
		if (normalizedEntry === '/' || normalizedEntry.startsWith('/')) return false;

		// Reject Windows absolute paths and drive letters
		if (path.isAbsolute(entryPath)) return false;
		if (/^[a-zA-Z]:/.test(normalizedEntry)) return false;

		// Resolve and verify the target stays within rootDir
		const resolvedRoot = path.resolve(rootDir);
		const resolvedTarget = path.resolve(rootDir, entryPath);

		if (resolvedTarget === resolvedRoot) return false;
		if (!resolvedTarget.startsWith(resolvedRoot + path.sep)) return false;

		return true;
	}

	private async unzip(filePath: string, extractDir: string): Promise<void> {
		try {
			await fs.mkdir(extractDir, { recursive: true });
			let totalSize = 0;

			await new Promise<void>((resolve, reject) => {
				const pendingWrites: Promise<void>[] = [];

				createReadStream(filePath)
					.pipe(unzipper.Parse())
					.on('entry', (entry: any) => {
						const { path: entryPath, type } = entry;

						// Security: Zip Slip prevention
						if (!this.isSafePath(extractDir, entryPath)) {
							logger.warn(`Unsafe archive entry skipped: ${entryPath}`);
							return entry.autodrain();
						}

						const resolvedPath = path.resolve(extractDir, entryPath);

						if (type === 'Directory') {
							// Issue 4: autodrain synchronously first to avoid backpressure,
							// then push only the mkdir promise.
							entry.autodrain();
							pendingWrites.push(fs.mkdir(resolvedPath, { recursive: true }).then(() => void 0));
							return;
						}

						// Issue 2: File extraction with actual byte-count enforcement.
						// `entry.size` from ZIP metadata may be 0 or the compressed size,
						// so we count bytes via data events instead.
						pendingWrites.push(
							(async () => {
								let writeStream: ReturnType<typeof createWriteStream> | null = null;
								let bytesWritten = 0;
								let limitReached = false;
								try {
									await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
									writeStream = createWriteStream(resolvedPath);

									// Attach counter before piping so every chunk is measured.
									entry.on('data', (chunk: Buffer) => {
										if (limitReached) return;
										bytesWritten += chunk.length;
										totalSize += chunk.length;

										if (bytesWritten > LocalDownloadStrategy.MAX_FILE_SIZE) {
											limitReached = true;
											logger.warn(`File size limit exceeded (actual bytes): ${entryPath}`);
											entry.unpipe(writeStream);
											if (writeStream && !writeStream.writableEnded) writeStream.destroy();
											reject(
												new Error(
													`File too large: ${entryPath} exceeds ${LocalDownloadStrategy.MAX_FILE_SIZE} bytes`
												)
											);
											return;
										}

										if (totalSize > LocalDownloadStrategy.MAX_TOTAL_SIZE) {
											limitReached = true;
											logger.warn(`Total extraction size exceeded at: ${entryPath}`);
											entry.unpipe(writeStream);
											if (writeStream && !writeStream.writableEnded) writeStream.destroy();
											reject(
												new Error(
													`Total extraction size exceeded (${LocalDownloadStrategy.MAX_TOTAL_SIZE} bytes)`
												)
											);
											return;
										}
									});

									entry.pipe(writeStream);
									await finished(writeStream);
								} catch (err) {
									if (!limitReached) {
										// Issue 3: unpipe entry from writeStream and destroy writeStream
										// properly so the error propagates and the pipe is cleaned up.
										if (writeStream) entry.unpipe(writeStream);
										if (writeStream && !writeStream.writableEnded) writeStream.destroy(err);
										try {
											await fs.unlink(resolvedPath);
										} catch {}
									}
									throw err;
								}
							})()
						);
					})
					.on('close', async () => {
						try {
							await Promise.all(pendingWrites);
							resolve();
						} catch (err) {
							reject(err);
						}
					})
					.on('error', reject);
			});

			logger.info(`File unzipped successfully (total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
		} catch (error) {
			throw new Error(`Failed to unzip file: ${error.message}`);
		}
	}

	private async findPluginDirectory(basePath: string, zipFileName: string): Promise<string | null> {
		try {
			// Try the expected directory name first (zip filename without extension)
			const expectedDir = path.join(basePath, zipFileName.replace(/\.zip$/i, ''));
			try {
				await fs.access(expectedDir);
				return expectedDir;
			} catch {
				// Fall back to searching for manifest.json
				return await this.searchForManifest(basePath);
			}
		} catch (error) {
			logger.error(`Error finding plugin directory: ${error.message}`);
			return null;
		}
	}

	private async searchForManifest(startPath: string): Promise<string | null> {
		const results: string[] = [];

		const search = async (currentDir: string, depth: number): Promise<boolean> => {
			if (depth > 3) return false;

			try {
				const files = await fs.readdir(currentDir);

				for (const file of files) {
					const fullPath = path.join(currentDir, file);
					const stat = await fs.stat(fullPath);

					if (stat.isDirectory()) {
						const found = await search(fullPath, depth + 1);
						if (found) return true;
					} else if (file === LocalDownloadStrategy.MANIFEST_FILENAME) {
						results.push(fullPath);
						return true;
					}
				}
			} catch (error) {
				logger.warn(`Error searching directory ${currentDir}: ${error.message}`);
			}
			return false;
		};

		await search(startPath, 0);

		if (results.length === 0) {
			throw new Error(`No ${LocalDownloadStrategy.MANIFEST_FILENAME} found in the zip file`);
		}

		return path.dirname(results[0]);
	}

	private async readAndValidateManifest(pluginDir: string): Promise<any> {
		const manifestPath = path.join(pluginDir, LocalDownloadStrategy.MANIFEST_FILENAME);

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

	private async cleanupOnError(zipFilePath: string | null, tempExtractPath?: string): Promise<void> {
		try {
			if (zipFilePath) {
				await this.cleanupZipFile(zipFilePath);
			}
			if (tempExtractPath) {
				try {
					await fs.rm(tempExtractPath, { recursive: true, force: true });
				} catch (error) {
					logger.warn(`Failed to cleanup temp extraction directory: ${tempExtractPath}`);
				}
			}
		} catch (cleanupError) {
			logger.warn(`Cleanup failed: ${cleanupError.message}`);
		}
	}
}
