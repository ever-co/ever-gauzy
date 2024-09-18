import * as logger from 'electron-log';
import { createReadStream, createWriteStream } from 'fs';
import * as fs from 'fs/promises';
import * as https from 'https';
import * as path from 'path';
import { createGunzip } from 'zlib';
import { INpmDownloadConfig, IPluginDownloadResponse, IPluginDownloadStrategy } from '../../shared';

export class NpmDownloadStrategy implements IPluginDownloadStrategy {
	public async execute<T>(config: T): Promise<IPluginDownloadResponse> {
		// Download tarball
		const tgzPath = await this.download(config as INpmDownloadConfig);
		// Decompress tarball
		const pluginDir = await this.decompressTarball(tgzPath);
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

	private async download({ pkg, pluginPath, registry }: INpmDownloadConfig) {
		const { name, version = 'latest' } = pkg;
		const { privateURL = null, authToken = null } = registry;

		let registryUrl = `https://registry.npmjs.org/${name}`;

		if (privateURL) {
			const url = new URL(privateURL);
			registryUrl = `${url.origin}/${name}`;
		}

		const options = {
			headers: {
				Authorization: `Bearer ${authToken}`
			}
		};

		try {
			const packageInfo = await this.fetchPackageInfo(registryUrl, options);
			const tarballUrl = this.getTarballUrl(packageInfo, version);
			const filename = `${name}-${version}.tgz`;
			const tarballPath = path.join(pluginPath, filename);

			await this.downloadTarball(tarballUrl, tarballPath);
			console.log(`Downloaded ${name} to ${tarballPath}`);
			return tarballPath;
		} catch (error) {
			console.error(`Error downloading package: ${error.message}`);
			throw error;
		}
	}

	private fetchPackageInfo(registryUrl: string, options: object): Promise<any> {
		return new Promise((resolve, reject) => {
			https
				.get(registryUrl, options, (res) => {
					let data = '';

					res.on('data', (chunk) => {
						data += chunk;
					});

					res.on('end', () => {
						try {
							resolve(JSON.parse(data));
						} catch (error) {
							reject(new Error('Failed to parse package info'));
						}
					});

					res.on('error', (err) => reject(err));
				})
				.on('error', (err) => reject(err));
		});
	}

	private getTarballUrl(packageInfo: any, version: string): string {
		const versionInfo = packageInfo.versions[version] || packageInfo['dist-tags'][version];
		if (!versionInfo) {
			throw new Error(`Version ${version} not found`);
		}
		return versionInfo.dist.tarball;
	}

	private downloadTarball(tarballUrl: string, tarballPath: string): Promise<void> {
		return new Promise((resolve, reject) => {
			https
				.get(tarballUrl, (response) => {
					const fileStream = createWriteStream(tarballPath);

					response.pipe(fileStream);

					fileStream.on('finish', () => {
						fileStream.close();
						resolve();
					});

					fileStream.on('error', reject);
				})
				.on('error', reject);
		});
	}

	private decompressTarball(pathToTarball: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const readStream = createReadStream(pathToTarball);
			const writeStream = createWriteStream(pathToTarball.replace('.tgz', ''));
			const gunzip = createGunzip();

			readStream.pipe(gunzip).pipe(writeStream);

			writeStream.on('finish', () => {
				resolve(pathToTarball.replace('.tgz', ''));
			});

			writeStream.on('error', reject);
		});
	}
}
