import * as logger from 'electron-log';
import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as https from 'https';
import * as path from 'path';
import {
	formatNpmVersion,
	INpmDownloadConfig,
	IPluginDownloadResponse,
	IPluginDownloadStrategy,
	TarballUtil
} from '../../shared';

export class NpmDownloadStrategy implements IPluginDownloadStrategy {
	public async execute<T>(config: T): Promise<IPluginDownloadResponse> {
		const { pluginPath } = config as INpmDownloadConfig;

		// Download tarball and read metadata
		const pluginDir = await this.download(config as INpmDownloadConfig);
		const manifestPath = path.join(pluginDir, 'manifest.json');

		const metadata = await this.readJSON(manifestPath);
		if (!metadata) {
			throw new Error(
				`The plugin at ${pluginDir} does not have a valid manifest.json file and therefore is not a compatible plugin`
			);
		}
		logger.info(`✔ Manifest.json has been read and parsed: ${JSON.stringify(metadata)}`);

		// rename pathDirname
		const pathDirname = path.join(pluginPath, `${Date.now()}-${metadata.name}`);
		await fs.rename(pluginDir, pathDirname);
		logger.info(`✔ Plugin directory renamed to: ${pathDirname}`);

		// Rename native modules to node_modules if available
		await this.renameNativeModules(pathDirname);
		// Install dependencies
		await this.installDependencies(pathDirname, config as INpmDownloadConfig);

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
			// Instantiate tarball utility.
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

	/**
	 * Reads and parses a JSON file from the file system.
	 */
	private async readJSON(filePath: string): Promise<any> {
		try {
			const fileContent = await fs.readFile(filePath, 'utf8');
			return JSON.parse(fileContent);
		} catch (error) {
			logger.error(`Error reading JSON file: ${error.message}`);
			return null;
		}
	}

	/**
	 * Installs dependencies recursively.
	 */
	private async installDependencies(dependencyDir: string, config: INpmDownloadConfig): Promise<void> {
		const packageJsonPath = path.join(dependencyDir, 'package.json');
		const packageJson = await this.readJSON(packageJsonPath);

		if (!packageJson) {
			console.warn(`No package.json found in ${dependencyDir}`);
			return;
		}

		// Get dependencies if they exist
		const dependencies = packageJson?.dependencies as Record<string, string>;

		if (!dependencies || Object.keys(dependencies).length === 0) {
			console.info(`No dependencies to install in ${dependencyDir}`);
			return;
		}

		// Create the node_modules directory if it doesn't exist
		await fs.mkdir(path.join(dependencyDir, 'node_modules'), { recursive: true });

		// Install dependencies in sequence
		for (const [dependency, version] of Object.entries(dependencies)) {
			await this.installDependency({
				...config,
				pkg: { name: dependency, version: formatNpmVersion(version) },
				pluginPath: path.join(dependencyDir, 'node_modules')
			});
		}
	}
	/**
	 * Installs a single dependency by downloading and extracting it.
	 */
	private async installDependency(config: INpmDownloadConfig): Promise<void> {
		try {
			// Ensure directory exists
			await fs.mkdir(config.pluginPath, { recursive: true });
			logger.info(`Created or confirmed directory: ${config.pluginPath}`);

			// Download and retrieve the temporary directory path
			const downloadedDir = await this.download(config);
			logger.info(`Downloaded package to: ${downloadedDir}`);

			// Define the final dependency directory
			const depDir = path.join(config.pluginPath, config.pkg.name);

			// Rename the downloaded directory to the final destination
			await fs.rename(downloadedDir, depDir);
			logger.info(`✔ Dependency directory renamed to: ${depDir}`);

			// Install dependencies in the renamed directory
			await this.installDependencies(depDir, config);
			logger.info(`Dependencies installed successfully for: ${depDir}`);
		} catch (error) {
			logger.error(`Failed to install dependency: ${config.pkg.name}`, error);
		}
	}

	private async renameNativeModules(pathDirname: string) {
		// Define paths for native and node modules
		const nativeModulesPath = path.join(pathDirname, 'native_modules');
		const nodeModulesPath = path.join(pathDirname, 'node_modules');

		try {
			// Check if native modules directory exists
			if (existsSync(nativeModulesPath)) {
				// Rename native_modules to node_modules
				await fs.rename(nativeModulesPath, nodeModulesPath);
				logger.info(`✔ Plugin native modules ${nativeModulesPath} renamed to: ${nodeModulesPath}`);
			} else {
				logger.info(`✔ No native modules found`);
			}
		} catch (error) {
			// Handle errors during renaming
			logger.error(`✖ Error renaming ${nativeModulesPath} to ${nodeModulesPath}: ${error.message}`);
		}
	}
}
