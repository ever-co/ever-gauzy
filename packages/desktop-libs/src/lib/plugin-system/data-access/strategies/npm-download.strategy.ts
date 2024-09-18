import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import { INpmDownloadConfig, IPluginDownloadResponse, IPluginDownloadStrategy } from '../../shared';

export class NpmDownloadStrategy implements IPluginDownloadStrategy {
	public execute<T>(config: T): Promise<IPluginDownloadResponse> {
		const tgzPath = this.download(config as INpmDownloadConfig);
		return;
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
			const tarballPath = path.join(pluginPath, `${name}-${version}.tgz`);

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
					const fileStream = fs.createWriteStream(tarballPath);

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
}
