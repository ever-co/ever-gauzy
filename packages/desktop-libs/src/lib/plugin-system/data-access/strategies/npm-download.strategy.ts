import * as logger from 'electron-log';
import * as fs from 'fs/promises';
import * as https from 'https';
import * as path from 'path';
import { INpmDownloadConfig, IPluginDownloadResponse, IPluginDownloadStrategy, TarballUtil } from '../../shared';

export class NpmDownloadStrategy implements IPluginDownloadStrategy {
	public async execute<T>(config: T): Promise<IPluginDownloadResponse> {
		const { pluginPath } = config as INpmDownloadConfig;
		// Download tarball
		const pluginDir = await this.download(config as INpmDownloadConfig);
		// Read and parse the metadata
		const metadata = JSON.parse(
			await fs.readFile(path.join(pluginDir, 'manifest.json'), {
				encoding: 'utf8'
			})
		);
		logger.info(`✔ Manifest.json has been read and parsed: ${JSON.stringify(metadata)}`);
		// rename pathDirname
		const pathDirname = path.join(pluginPath, `${Date.now()}-${metadata.name}`);
		await fs.rename(pluginDir, pathDirname);
		logger.info(`✔ Plugin directory renamed to: ${pathDirname}`);

		return { pathDirname, metadata };
	}

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
				...(authToken && { Authorization: `Bearer ${authToken}` })
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
			// Instanciate tarball util
			const tgzUtil = new TarballUtil(options);
			// Download and extract the tarball files
			return tgzUtil.downloadAndExtract(tarballUrl, pluginPath);
		} catch (error) {
			logger.error(`Error downloading package: ${error.message}`);
			throw error;
		}
	}

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
}
