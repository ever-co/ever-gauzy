import * as logger from 'electron-log';
import { createReadStream, createWriteStream } from 'fs';
import * as fs from 'fs/promises';
import * as https from 'https';
import * as path from 'path';
import * as tar from 'tar';
import { INpmDownloadConfig, IPluginDownloadResponse, IPluginDownloadStrategy } from '../../shared';

export class NpmDownloadStrategy implements IPluginDownloadStrategy {
	public async execute<T>(config: T): Promise<IPluginDownloadResponse> {
		const { pluginPath } = config as INpmDownloadConfig;
		// Download tarball
		const tgzPath = await this.download(config as INpmDownloadConfig);
		// Decompress tarball
		const pluginDir = await this.extractTarball(tgzPath, pluginPath);
		// Read and parse the metadata
		const metadata = JSON.parse(
			await fs.readFile(path.join(pluginDir, 'manifest.json'), {
				encoding: 'utf8'
			})
		);
		logger.info(`✔ Manifest.json has been read and parsed: ${JSON.stringify(metadata)}`);
		// rename pathDirname
		const pathDirname = path.join(pluginDir, `${Date.now()}-${metadata.name}`);

		await fs.rename(pluginDir, pathDirname);
		logger.info(`✔ Plugin directory renamed to: ${pathDirname}`);

		// Remove downloaded .tgz
		await fs.rm(tgzPath, { recursive: true, force: true, retryDelay: 1000, maxRetries: 3 });
		logger.info(`✔ Downloaded .tgz file has been removed`);

		return { pathDirname, metadata };
	}

	/*************  ✨ Codeium Command 🌟  *************/
	/**
	 * Downloads a package from the npm registry.
	 *
	 * @param {INpmDownloadConfig} config - The configuration object for the download.
	 * @returns {Promise<string>} A promise that resolves to the path to the downloaded tarball.
	 */
	private async download({ pkg, pluginPath, registry }: INpmDownloadConfig): Promise<string> {
		const { name, version = 'latest' } = pkg;
		const { privateURL = null, authToken = null } = registry;

		let registryUrl = `https://registry.npmjs.org/${name}`;

		if (privateURL) {
			// If a private registry URL is provided, use that instead of the public registry
			const url = new URL(privateURL);
			registryUrl = `${url.origin}/${name}`;
		}

		const options = {
			headers: {
				// Set the Authorization header if an auth token is provided
				Authorization: authToken ? `Bearer ${authToken}` : undefined
			}
		};

		try {
			// Fetch the package info from the registry
			logger.info(`Fetching package info from ${registryUrl}`);
			const packageInfo = await this.fetchPackageInfo(registryUrl, options);
			logger.info(`Package info: ${JSON.stringify(packageInfo)}`);
			// Get the URL to the tarball
			const tarballUrl = this.getTarballUrl(packageInfo, version);
			logger.info(`Tarball URL: ${tarballUrl}`);
			// Create the filename for the tarball
			const filename = `${name}-${version}.tgz`;
			// Create the path to the tarball
			const tarballPath = path.join(pluginPath, filename);
			// Download the tarball
			logger.info(`Downloading tarball to ${tarballPath}`);
			await this.downloadTarball(tarballUrl, tarballPath);
			logger.info(`Downloaded ${name} to ${tarballPath}`);
			return tarballPath;
		} catch (error) {
			logger.error(`Error downloading package: ${error.message}`);
			throw error;
		}
	}
	/******  838cc8b9-8387-499a-9d1b-16f48ea7dfc0  *******/

	/**
	 * Fetches the package info for a given package name and version.
	 *
	 * @param {string} registryUrl - The URL of the registry to fetch the package info from.
	 * @param {object} options - The options for the request.
	 * @returns {Promise<any>} A promise that resolves to the package info.
	 */
	private async fetchPackageInfo(registryUrl: string, options: object): Promise<any> {
		return new Promise((resolve, reject) => {
			https
				.get(registryUrl, options, (res) => {
					// Accumulate the response data
					let data = '';

					res.on('data', (chunk) => {
						data += chunk;
					});

					res.on('end', () => {
						// Attempt to parse the JSON response
						try {
							const packageInfo = JSON.parse(data);
							resolve(packageInfo);
						} catch (error) {
							// If the response is not valid JSON, reject the promise
							reject(new Error('Failed to parse package info'));
						}
					});

					// Handle errors
					res.on('error', (err) => reject(err));
				})
				.on('error', (err) => reject(err));
		});
	}

	/**
	 * Returns the URL of the tarball for the given package and version.
	 *
	 * @param {object} packageInfo - The package info object from the registry.
	 * @param {string} version - The version of the package to fetch.
	 * @returns {string} The URL of the tarball.
	 */
	private getTarballUrl(packageInfo: any, version: string): string {
		const versionInfo = packageInfo.versions[version] || packageInfo['dist-tags'][version];
		if (!versionInfo) {
			// Log available versions and dist-tags for debugging
			logger.error(
				`Version ${version} not found in packageInfo.
				Available versions: ${Object.keys(packageInfo.versions)}`
			);
			throw new Error(`Version ${version} not found`);
		}
		return versionInfo.dist.tarball;
	}

	/**
	 * Downloads a tarball from the given URL and saves it to the given path.
	 *
	 * @param tarballUrl - The URL of the tarball to download.
	 * @param tarballPath - The path to save the tarball to.
	 * @returns A promise that resolves when the download is complete.
	 */
	private downloadTarball(tarballUrl: string, tarballPath: string): Promise<void> {
		return new Promise((resolve, reject) => {
			https
				.get(tarballUrl, (response) => {
					// Create a write stream to the file we want to save the tarball to.
					const fileStream = createWriteStream(tarballPath);
					// Pipe the response stream to the file stream.
					response.pipe(fileStream);
					// When the file stream is finished, resolve the promise.
					fileStream.on('finish', () => {
						fileStream.close();
						resolve();
					});
					// If there is an error, reject the promise.
					fileStream.on('error', reject);
				})
				.on('error', reject);
		});
	}

	/**
	 * Extracts a tarball to a directory.
	 *
	 * @param pathToTarball - The path to the tarball to extract.
	 * @param extractDir - The directory to extract the tarball to.
	 * @returns A promise that resolves when the extraction is complete, with the full path to the root directory.
	 */
	private extractTarball(pathToTarball: string, extractDir: string): Promise<string> {
		// Create a read stream from the tarball.
		const readStream = createReadStream(pathToTarball);
		// Create an extract stream to extract the tarball.
		const extract = tar.extract({ cwd: extractDir });
		// Handle errors and completion.
		let rootDir: string | null = null;

		/**
		 * Captures the root directory from the first entry (file or folder)
		 * in the tarball.
		 *
		 * @param header - The header of the current entry.
		 */
		extract.on('entry', ({ path: pathname }) => {
			// Ensure the header name exists before trying to split it
			logger.info('exctraction', pathname);
			// Set root directory
			if (pathname && !rootDir) {
				rootDir = pathname.split(path.sep)[0]; // Get the top-level directory
			}
		});

		/**
		 * Handles the close event of the extract stream.
		 */
		extract.on('close', () => {
			logger.info(`✔ Tarball extracted to ${extractDir}`);
		});

		/**
		 * Handles any errors that occur during the extraction process.
		 *
		 * @param err - The error that occurred.
		 */
		extract.on('error', (err) => {
			logger.error(`Error extracting tarball: ${err.message}`);
			throw err;
		});

		/**
		 * Handles any errors that occur while reading the tarball.
		 *
		 * @param err - The error that occurred.
		 */
		readStream.on('error', (err) => {
			logger.error(`Error reading tarball: ${err.message}`);
			throw err;
		});

		// Pipe the read stream to the extract stream.
		readStream.pipe(extract);
		// Return a promise that resolves when the extraction is complete.
		return new Promise((resolve, reject) => {
			/**
			 * Handles the close event of the extract stream, and resolves
			 * the promise with the full path to the root directory.
			 *
			 * @param arg - The argument passed to the close event.
			 */
			extract.on('close', () => {
				if (rootDir) {
					resolve(path.join(extractDir, rootDir)); // Resolve with full path to the root directory
				} else {
					reject(new Error('No root directory found in tarball.'));
				}
			});
			/**
			 * Handles any errors that occur during the extraction process.
			 *
			 * @param err - The error that occurred.
			 */
			extract.on('error', reject);
		});
	}
}
