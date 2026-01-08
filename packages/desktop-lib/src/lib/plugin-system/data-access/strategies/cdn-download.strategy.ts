import { logger } from '@gauzy/desktop-core';
import { createReadStream, createWriteStream } from 'fs';
import * as fs from 'fs/promises';
import fetch from 'node-fetch';
import { finished, pipeline } from 'node:stream/promises';
import * as path from 'path';
import * as unzipper from 'unzipper';
import { ICdnDownloadConfig, IPluginDownloadResponse, IPluginDownloadStrategy } from '../../shared';

export class CdnDownloadStrategy implements IPluginDownloadStrategy {
	private static readonly MAX_RETRIES = 3;
	private static readonly RETRY_DELAY_MS = 1000;
	private static readonly VALID_EXTENSION = '.zip';
	private static readonly MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB per file
	private static readonly MAX_TOTAL_SIZE = 1024 * 1024 * 1024; // 1GB total extraction limit
	private static readonly DOWNLOAD_TIMEOUT_MS = 300000; // 5 minutes
	private static readonly MANIFEST_FILENAME = 'manifest.json';
	private static readonly USE_STREAMING = true; // Enable direct streaming
	private static readonly ALLOWED_PROTOCOLS = ['https:', 'http:'];
	// Pattern to identify existing plugin directories (timestamp-pluginname)
	private static readonly PLUGIN_DIR_PATTERN = /^\d{13}-/;

	/**
	 * Downloads and installs a plugin from a CDN URL
	 * @param config Configuration for the download
	 * @returns Promise resolving to plugin location and metadata
	 * @throws Error if any step in the process fails
	 */
	async execute<T>(config: T): Promise<IPluginDownloadResponse> {
		// Runtime validation of config
		if (!config) {
			throw new Error('Invalid configuration provided');
		}

		const { url, pluginPath } = config as ICdnDownloadConfig;

		if (!url || typeof url !== 'string') {
			throw new Error('Invalid or missing URL in configuration');
		}

		if (!pluginPath || typeof pluginPath !== 'string') {
			throw new Error('Invalid or missing pluginPath in configuration');
		}

		let zipFilePath: string | null = null;
		let extractedFiles: string[] = [];

		try {
			// Validate URL and extension
			this.validateUrl(url);

			// Prepare directories
			await this.prepareDirectory(pluginPath);

			if (CdnDownloadStrategy.USE_STREAMING) {
				// Stream directly from URL to extraction (memory efficient)
				return await this.streamAndExtract(url, pluginPath);
			} else {
				// Traditional approach: download then extract
				zipFilePath = await this.downloadPlugin(url, pluginPath);
				return await this.processDownloadedFile(zipFilePath, pluginPath);
			}
		} catch (error) {
			logger.error(`Plugin installation failed: ${error.message}`);
			await this.cleanupOnError(zipFilePath, extractedFiles);
			throw error;
		}
	}

	private validateUrl(url: string): void {
		if (!url) {
			throw new Error('URL cannot be empty');
		}

		// Parse and validate URL
		let parsedUrl: URL;
		try {
			parsedUrl = new URL(url);
		} catch (error) {
			throw new Error('Invalid URL format');
		}

		// Validate protocol
		if (!CdnDownloadStrategy.ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
			throw new Error(`URL protocol must be one of: ${CdnDownloadStrategy.ALLOWED_PROTOCOLS.join(', ')}`);
		}

		// Validate file extension
		const ext = path.extname(parsedUrl.pathname).toLowerCase();
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
		const fileName = path.basename(new URL(url).pathname);
		const zipFilePath = path.join(downloadDir, fileName);

		let lastError: Error | null = null;

		// Retry logic with exponential backoff
		for (let attempt = 1; attempt <= CdnDownloadStrategy.MAX_RETRIES; attempt++) {
			try {
				logger.info(`Download attempt ${attempt}/${CdnDownloadStrategy.MAX_RETRIES} from: ${url}`);

				// Create abort controller for timeout
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), CdnDownloadStrategy.DOWNLOAD_TIMEOUT_MS);

				try {
					const response = await fetch(url, { signal: controller.signal });

					if (!response.ok) {
						throw new Error(`HTTP ${response.status}: ${response.statusText}`);
					}

					if (!response.body) {
						throw new Error('No response body received');
					}

					// Validate content length if provided
					const contentLength = response.headers.get('content-length');
					if (contentLength) {
						const size = parseInt(contentLength, 10);
						if (size > CdnDownloadStrategy.MAX_FILE_SIZE) {
							throw new Error(
								`File size (${size} bytes) exceeds maximum allowed (${CdnDownloadStrategy.MAX_FILE_SIZE} bytes)`
							);
						}
						logger.info(`Download size: ${(size / 1024 / 1024).toFixed(2)} MB`);
					}

					// Stream the download directly to file with size tracking
					const fileStream = createWriteStream(zipFilePath);
					let downloadedBytes = 0;

					await new Promise<void>((resolve, reject) => {
						response
							.body!.on('data', (chunk: Buffer) => {
								downloadedBytes += chunk.length;
								if (downloadedBytes > CdnDownloadStrategy.MAX_FILE_SIZE) {
									reject(new Error('Download size limit exceeded'));
								}
							})
							.pipe(fileStream)
							.on('finish', resolve)
							.on('error', reject);
					});

					logger.info(
						`Download completed: ${zipFilePath} (${(downloadedBytes / 1024 / 1024).toFixed(2)} MB)`
					);
					return zipFilePath;
				} finally {
					clearTimeout(timeoutId);
				}
			} catch (error) {
				lastError = error as Error;
				logger.warn(`Download attempt ${attempt} failed: ${error.message}`);

				// Clean up failed download
				try {
					await fs.unlink(zipFilePath);
				} catch {}

				// Don't retry on timeout or if it's the last attempt
				if (attempt < CdnDownloadStrategy.MAX_RETRIES && !error.message.includes('aborted')) {
					const delay = CdnDownloadStrategy.RETRY_DELAY_MS * Math.pow(2, attempt - 1);
					logger.info(`Retrying in ${delay}ms...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
				} else {
					break;
				}
			}
		}

		throw new Error(`Download failed after ${CdnDownloadStrategy.MAX_RETRIES} attempts: ${lastError?.message}`);
	}

	private async processDownloadedFile(zipFilePath: string, pluginPath: string): Promise<IPluginDownloadResponse> {
		const tempExtractPath = path.join(pluginPath, `.temp-extract-${Date.now()}`);

		try {
			// Unzip the file to isolated temp directory
			await this.unzip(zipFilePath, tempExtractPath);

			// Find the plugin directory (handles different zip structures)
			// Only search within the isolated temp directory
			const pluginDir = await this.findPluginDirectory(tempExtractPath, path.basename(zipFilePath));

			if (!pluginDir) {
				throw new Error('Could not find plugin directory in the downloaded zip');
			}

			// Read and validate manifest
			const metadata = await this.readAndValidateManifest(pluginDir);

			// Create unique directory for plugin
			const pathDirname = await this.createUniquePluginDirectory(pluginPath, pluginDir, metadata.name);

			// Cleanup temporary files
			await this.cleanupZipFile(zipFilePath);

			// Cleanup temp extraction directory
			try {
				await fs.rm(tempExtractPath, { recursive: true, force: true });
			} catch (error) {
				logger.warn(`Failed to cleanup temp extraction directory: ${tempExtractPath}`);
			}

			return { pathDirname, metadata };
		} catch (error) {
			// Cleanup temp extraction directory on error
			try {
				await fs.rm(tempExtractPath, { recursive: true, force: true });
			} catch {}
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
		const manifestPaths = await this.findFiles(startPath, CdnDownloadStrategy.MANIFEST_FILENAME, 3);

		if (manifestPaths.length === 0) {
			throw new Error(`No ${CdnDownloadStrategy.MANIFEST_FILENAME} found in the unzipped directory`);
		}

		// Use the first manifest found (closest to root)
		return path.dirname(manifestPaths[0]);
	}

	private async findFiles(dir: string, fileName: string, maxDepth: number): Promise<string[]> {
		const results: string[] = [];

		async function search(currentDir: string, depth: number): Promise<boolean> {
			if (depth > maxDepth) return false;

			try {
				const files = await fs.readdir(currentDir);

				for (const file of files) {
					const fullPath = path.join(currentDir, file);
					const stat = await fs.stat(fullPath);

					if (stat.isDirectory()) {
						// Skip existing plugin directories and temp directories
						if (CdnDownloadStrategy.PLUGIN_DIR_PATTERN.test(file) || file.startsWith('.temp-extract-')) {
							logger.debug(`Skipping existing plugin/temp directory: ${file}`);
							continue;
						}

						const found = await search(fullPath, depth + 1);
						if (found) return true; // Early exit after finding first match
					} else if (file === fileName) {
						results.push(fullPath);
						return true; // Found it, stop searching
					}
				}
			} catch (error) {
				logger.warn(`Error searching directory ${currentDir}: ${error.message}`);
			}
			return false;
		}

		await search(dir, 0);
		return results;
	}

	private async unzip(filePath: string, extractDir: string): Promise<string> {
		try {
			let totalSize = 0;

			await new Promise<void>((resolve, reject) => {
				const pendingWrites: Promise<void>[] = [];

				createReadStream(filePath)
					.pipe(unzipper.Parse())
					.on('entry', (entry: any) => {
						const { path: entryPath, type, size } = entry;

						// Security: Normalize and validate entry path to prevent path traversal (Zip Slip)
						const normalizedEntryPath = path.normalize(entryPath);

						// Reject absolute paths and paths that attempt to traverse upwards
						if (
							!normalizedEntryPath || // empty or falsy
							path.isAbsolute(normalizedEntryPath) ||
							normalizedEntryPath.startsWith('..' + path.sep) ||
							normalizedEntryPath === '..' ||
							normalizedEntryPath.includes(path.sep + '..' + path.sep) ||
							normalizedEntryPath.endsWith(path.sep + '..')
						) {
							logger.warn(`Suspicious or unsafe path detected, skipping: ${entryPath}`);
							entry.autodrain();
							return;
						}

						// Security: Check individual file size
						if (size > CdnDownloadStrategy.MAX_FILE_SIZE) {
							logger.warn(`File too large (${size} bytes), skipping: ${entryPath}`);
							entry.autodrain();
							return;
						}

						// Security: Check total extracted size
						totalSize += size;
						if (totalSize > CdnDownloadStrategy.MAX_TOTAL_SIZE) {
							reject(
								new Error(
									`Total extraction size exceeds limit (${CdnDownloadStrategy.MAX_TOTAL_SIZE} bytes)`
								)
							);
							return;
						}

						// Build the full output path from the normalized entry path
						const fullPath = path.join(extractDir, normalizedEntryPath);
						const resolvedFullPath = path.resolve(fullPath);

						if (type === 'Directory') {
							entry.autodrain();
						} else {
							// Create a promise for this write operation and track it
							const writePromise = (async () => {
								let writeStream: ReturnType<typeof createWriteStream> | null = null;
								try {
									// Ensure directory exists before writing file
									await fs.mkdir(path.dirname(resolvedFullPath), { recursive: true });
									// Extract file and wait for stream to finish
									writeStream = createWriteStream(resolvedFullPath);
									entry.pipe(writeStream);
									await finished(writeStream);
								} catch (err) {
									logger.error(
										`Failed to write file ${resolvedFullPath}: ${
											err instanceof Error ? err.stack || err.message : String(err)
										}`
									);

									// Destroy streams to release resources
									if (!entry.destroyed) {
										entry.destroy();
									}
									if (writeStream && !writeStream.destroyed) {
										writeStream.destroy();
									}

									// Remove incomplete target file if it exists
									try {
										await fs.unlink(resolvedFullPath);
										logger.info(`Removed incomplete file: ${resolvedFullPath}`);
									} catch (unlinkErr) {
										// File may not exist or already removed, ignore ENOENT errors
										if ((unlinkErr as NodeJS.ErrnoException).code !== 'ENOENT') {
											logger.warn(
												`Failed to remove incomplete file ${resolvedFullPath}: ${
													unlinkErr instanceof Error ? unlinkErr.message : String(unlinkErr)
												}`
											);
										}
									}

									// Re-throw to propagate error to Promise.all
									throw err;
								}
							})();
							pendingWrites.push(writePromise);
						}
					})
					.on('close', async () => {
						// Wait for all pending write operations to complete before resolving
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
			return extractDir;
		} catch (error) {
			throw new Error(`Unzip failed: ${error.message}`);
		}
	}

	private async readAndValidateManifest(pluginDir: string): Promise<any> {
		const manifestPath = path.join(pluginDir, CdnDownloadStrategy.MANIFEST_FILENAME);

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

	private async cleanupOnError(zipFilePath: string | null, extractedFiles: string[] = []): Promise<void> {
		try {
			if (zipFilePath) {
				await this.cleanupZipFile(zipFilePath);
			}
			// Cleanup any partially extracted files
			for (const file of extractedFiles) {
				try {
					await fs.rm(file, { recursive: true, force: true });
				} catch (error) {
					logger.warn(`Failed to cleanup extracted file: ${file}`);
				}
			}
		} catch (cleanupError) {
			logger.warn(`Cleanup failed: ${cleanupError.message}`);
		}
	}

	/**
	 * Validates that a file path is safe and doesn't attempt path traversal
	 */
	private isSafePath(rootDir: string, entryPath: string): boolean {
		if (!entryPath) {
			return false;
		}

		// Normalize entry path separators
		const normalizedEntry = entryPath.replaceAll('\\', '/');

		// Explicitly reject Unix-style absolute paths (fast fail on all platforms)
		if (normalizedEntry === '/' || normalizedEntry.startsWith('/')) {
			return false;
		}

		// Disallow absolute paths and drive letters
		if (path.isAbsolute(entryPath)) {
			return false;
		}
		if (/^[a-zA-Z]:/.test(normalizedEntry)) {
			return false;
		}

		// Resolve the full path and ensure it stays within rootDir
		const resolvedRoot = path.resolve(rootDir);
		const resolvedTarget = path.resolve(rootDir, entryPath);

		// Ensure the resolved target is within the resolved root directory
		if (resolvedTarget === resolvedRoot) {
			return false;
		}

		if (!resolvedTarget.startsWith(resolvedRoot + path.sep)) {
			return false;
		}

		return true;
	}

	/**
	 * Stream download and extract directly without saving zip file (memory efficient)
	 */
	private async streamAndExtract(url: string, pluginPath: string): Promise<IPluginDownloadResponse> {
		// Use timestamped temp directory to isolate from existing plugins
		const extractPath = path.join(pluginPath, `.temp-extract-${Date.now()}`);
		const extractedFiles: string[] = [];
		let pluginDir: string | null = null;
		let totalExtractedSize = 0;

		try {
			await fs.mkdir(extractPath, { recursive: true });

			logger.info(`Starting streaming download and extraction from: ${url}`);

			// Create abort controller for timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), CdnDownloadStrategy.DOWNLOAD_TIMEOUT_MS);

			try {
				const response = await fetch(url, { signal: controller.signal });

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				if (!response.body) {
					throw new Error('No response body received');
				}

				// Validate content length if provided
				const contentLength = response.headers.get('content-length');
				if (contentLength) {
					const size = parseInt(contentLength, 10);
					if (size > CdnDownloadStrategy.MAX_FILE_SIZE) {
						throw new Error(`File size (${size} bytes) exceeds maximum allowed`);
					}
				}

				// Stream directly to extraction with security checks
				await new Promise<void>((resolve, reject) => {
					const pendingWrites: Promise<void>[] = [];

					response
						.body!.pipe(unzipper.Parse())
						.on('entry', (entry: any) => {
							const { path: entryPath, type, size } = entry;

							// Guard: path traversal
							if (!this.isSafePath(extractPath, entryPath)) {
								logger.warn(`Unsafe archive entry skipped: ${entryPath}`);
								return entry.autodrain();
							}

							// Guard: per-file size
							if (size > CdnDownloadStrategy.MAX_FILE_SIZE) {
								logger.warn(`Archive entry too large (${size} bytes): ${entryPath}`);
								return entry.autodrain();
							}

							// Guard: total extraction size
							totalExtractedSize += size;
							if (totalExtractedSize > CdnDownloadStrategy.MAX_TOTAL_SIZE) {
								return reject(
									new Error(
										`Total extraction size exceeded (${CdnDownloadStrategy.MAX_TOTAL_SIZE} bytes)`
									)
								);
							}

							const resolvedPath = path.resolve(extractPath, entryPath);

							// Directory handling
							if (type === 'Directory') {
								pendingWrites.push(this.createDirectory(resolvedPath, extractedFiles, entry));
								return;
							}

							// File handling
							pendingWrites.push(
								this.extractFile({
									entry,
									entryPath,
									targetPath: resolvedPath,
									extractedFiles,
									baseDir: extractPath,
									onManifestDetected: (dir) => {
										if (!pluginDir) pluginDir = dir;
									}
								})
							);
						})
						.on('finish', async () => {
							// Wait for all pending write operations to complete before resolving
							try {
								await Promise.all(pendingWrites);
								resolve();
							} catch (err) {
								reject(err);
							}
						})
						.on('error', reject);
				});
			} finally {
				clearTimeout(timeoutId);
			}

			logger.info(
				`Streaming extraction completed (total size: ${(totalExtractedSize / 1024 / 1024).toFixed(2)} MB)`
			);

			// Find plugin directory if not detected during extraction
			// Only search within the isolated temp directory
			if (!pluginDir) {
				pluginDir = await this.findPluginDirectory(extractPath, path.basename(url));
			}

			if (!pluginDir) {
				throw new Error('Could not find plugin directory in the extracted content');
			}

			// Read and validate manifest
			const metadata = await this.readAndValidateManifest(pluginDir);

			// Create unique directory for plugin
			const finalPath = await this.createUniquePluginDirectory(pluginPath, pluginDir, metadata.name);

			// Cleanup temp extraction folder
			try {
				await fs.rm(extractPath, { recursive: true, force: true });
				logger.info(`Cleaned up temp extraction folder: ${extractPath}`);
			} catch (error) {
				logger.warn(`Failed to cleanup temp extraction folder: ${extractPath}`);
			}

			return { pathDirname: finalPath, metadata };
		} catch (error) {
			// Cleanup on error
			await this.cleanupOnError(null, [extractPath]);
			throw new Error(`Streaming extraction failed: ${error.message}`);
		}
	}

	private async createDirectory(dirPath: string, extractedFiles: string[], entry: unzipper.Entry): Promise<void> {
		try {
			await fs.mkdir(dirPath, { recursive: true });
			extractedFiles.push(dirPath);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err);
			logger.error(`Failed to create directory ${dirPath}: ${errorMessage}`);
			throw new Error(`Failed to create directory ${dirPath}: ${errorMessage}`);
		} finally {
			entry.autodrain();
		}
	}

	private async extractFile(options: {
		entry: unzipper.Entry;
		entryPath: string;
		targetPath: string;
		extractedFiles: string[];
		baseDir: string;
		onManifestDetected: (dir: string) => void;
	}): Promise<void> {
		const { entry, entryPath, targetPath, extractedFiles, baseDir, onManifestDetected } = options;

		let writeStream: ReturnType<typeof createWriteStream> | null = null;
		let safeTargetPath: string | null = null;

		try {
			// Resolve and validate the target path to prevent path traversal
			const baseRealPath = await fs.realpath(baseDir);
			safeTargetPath = path.resolve(baseRealPath, path.relative(baseDir, targetPath));

			if (!safeTargetPath.startsWith(baseRealPath + path.sep)) {
				logger.warn(`Unsafe target path detected, skipping extraction of entry: ${entryPath}`);
				entry.autodrain();
				return;
			}

			await fs.mkdir(path.dirname(safeTargetPath), { recursive: true });

			writeStream = createWriteStream(safeTargetPath);

			// Use pipeline for proper stream handling with error propagation
			await pipeline(entry, writeStream);

			extractedFiles.push(safeTargetPath);

			if (path.basename(entryPath) === CdnDownloadStrategy.MANIFEST_FILENAME) {
				onManifestDetected(path.dirname(safeTargetPath));
			}
		} catch (err) {
			logger.error(
				`Failed to extract ${entryPath}: ${err instanceof Error ? err.stack || err.message : String(err)}`
			);

			// Destroy streams to release resources
			if (!entry.destroyed) {
				entry.destroy();
			}
			if (writeStream && !writeStream.destroyed) {
				writeStream.destroy();
			}

			// Remove incomplete target file if it exists
			if (safeTargetPath) {
				try {
					await fs.unlink(safeTargetPath);
					logger.info(`Removed incomplete file: ${safeTargetPath}`);
				} catch (unlinkErr) {
					// File may not exist or already removed, ignore ENOENT errors
					if ((unlinkErr as NodeJS.ErrnoException).code !== 'ENOENT') {
						logger.warn(
							`Failed to remove incomplete file ${safeTargetPath}: ${
								unlinkErr instanceof Error ? unlinkErr.message : String(unlinkErr)
							}`
						);
					}
				}
			}

			// Re-throw the error to propagate it to the caller
			throw err;
		}
	}
}
