import { logger } from '@gauzy/desktop-core';
import { createReadStream, createWriteStream } from 'fs';
import * as fs from 'fs/promises';
import * as https from 'https';
import * as path from 'path';
import { pipeline } from 'stream';
import * as tar from 'tar';
import { promisify } from 'util';

const pipe = promisify(pipeline);

export class TarballUtil {
	constructor(private readonly options: https.RequestOptions) { }
	// Downloads the tarball with retry logic
	private async retryDownloadTarball(tarballUrl: string, tarballPath: string, retries: number = 3): Promise<void> {
		for (let attempt = 1; attempt <= retries; attempt++) {
			try {
				await this.downloadTarball(tarballUrl, tarballPath);
				return; // If download succeeds, exit the loop
			} catch (error) {
				logger.warn(`Attempt ${attempt} to download tarball failed: ${error.message}`);
				if (attempt === retries) {
					throw new Error(`Failed to download after ${retries} attempts.`);
				}
				await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
			}
		}
	}

	// Actual tarball download logic
	public async downloadTarball(tarballUrl: string, tarballPath: string): Promise<void> {
		const directoryPath = path.dirname(tarballPath);
		logger.info('[downloadTarball] Directory::', directoryPath);

		// Ensure the directory exists before writing the file
		await fs.mkdir(directoryPath, { recursive: true });

		return new Promise((resolve, reject) => {
			https
				.get(tarballUrl, this.options, async (response) => {
					if (response.statusCode !== 200) {
						return reject(new Error(`Failed to download tarball, status code: ${response.statusCode}`));
					}
					const fileStream = createWriteStream(tarballPath);

					try {
						// Use pipeline for better stream handling and error capturing
						await pipe(response, fileStream);
						resolve();
					} catch (error) {
						reject(new Error(`Error writing tarball to disk: ${error.message}`));
					}
				})
				.on('error', (err) => {
					reject(new Error(`Error downloading tarball: ${err.message}`));
				});
		});
	}

	// Extracts the tarball after downloading
	public async extractTarball(pathToTarball: string, extractDir: string): Promise<string> {
		const readStream = createReadStream(pathToTarball);
		const extract = tar.extract({ cwd: extractDir });

		let rootDir: string | null = null;

		extract.on('entry', ({ path: pathname }) => {
			if (!rootDir && pathname) {
				rootDir = pathname.split(path.sep)[0]; // Get the top-level directory
			}
		});

		extract.on('close', () => {
			logger.info(`✔ Tarball extracted to ${extractDir}`);
		});

		extract.on('error', (err) => {
			logger.error(`Error extracting tarball: ${err.message}`);
			throw err;
		});

		return new Promise((resolve, reject) => {
			readStream
				.pipe(extract)
				.on('finish', () => {
					if (rootDir) {
						resolve(path.join(extractDir, rootDir));
					} else {
						reject(new Error('No root directory found in tarball.'));
					}
				})
				.on('error', reject);
		});
	}

	// Full download and extraction process
	public async downloadAndExtract(tarballUrl: string, extractDir: string): Promise<string> {
		const tarballPath = path.join(extractDir, path.basename(tarballUrl));

		// Retry download logic
		await this.retryDownloadTarball(tarballUrl, tarballPath, 3);
		logger.info(`✔ Tarball downloaded successfully to ${tarballPath}`);

		// Extract the tarball
		const extractedPath = await this.extractTarball(tarballPath, extractDir);
		logger.info(`✔ Tarball extracted successfully to ${extractedPath}`);

		// Clean up the tarball after successful extraction
		await fs.rm(tarballPath, { recursive: true, force: true });
		logger.info(`✔ Downloaded tarball removed after successful extraction.`);

		return extractedPath;
	}
}
