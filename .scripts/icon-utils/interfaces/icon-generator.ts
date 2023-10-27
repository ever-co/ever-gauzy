import { argv } from 'yargs';
import * as fs from 'fs';
import { isUndefined } from 'underscore';
import { DownloadContext } from '../context/download-context';
import { DownloadAssetStrategy } from '../concrete-download-strategy/download-asset-strategy';
import { DownloadHttpsStrategy } from '../concrete-download-strategy/download-https-strategy';

export abstract class IconGenerator {
	private downloadContext: DownloadContext;
	protected destination: string;
	protected imageUrl: string;
	protected desktop: string;

	protected constructor() {
		this.desktop = isUndefined(argv.desktop) ? null : String(argv.desktop);
		this.downloadContext = new DownloadContext();
	}

	protected async remove(filePath: string, force = false): Promise<void> {
		if (this.downloadContext.strategy instanceof DownloadAssetStrategy) {
			if (!force) {
				return;
			}
		}
		await new Promise((resolve, reject) =>
			fs.rm(filePath, (error) => {
				if (error) {
					console.error(
						'ERROR: An error occurred while removing the file:',
						error
					);
					reject(error);
				}
				resolve(true);
			})
		);
	}

	public checkUrlValidity(urlString: string): boolean {
		try {
			if (!urlString) {
				console.warn('WARNING: Path is invalid, its cannot be null.');
				return false;
			}

			const securedProtocol = urlString.indexOf('https://');
			const localProtocol = urlString.indexOf('assets');

			if (localProtocol > -1 && localProtocol === Number(0)) {
				console.log('✔ url is valid!');
				this.downloadContext.strategy = new DownloadAssetStrategy();
				return true;
			}

			if (securedProtocol > -1 && securedProtocol === Number(0)) {
				const url = new URL(urlString);
				console.log('✔ url is valid!');
				this.downloadContext.strategy = new DownloadHttpsStrategy();
				return !!url;
			}
			console.warn('WARNING: Only secured https url is allowed');
			return false;
		} catch (error) {
			console.error(error);
			return false;
		}
	}

	public async downloadImage(): Promise<string> {
		if (!this.desktop) {
			console.warn(
				'WARNING: A desktop application variant must be selected, process exit.'
			);
			process.exit(0);
		}
		if (!this.checkUrlValidity(this.imageUrl)) {
			return null;
		}

		return this.downloadContext.strategy.download(
			this.imageUrl,
			this.destination
		);
	}

	public async generate(): Promise<void> {
		try {
			const filePath = await this.downloadImage();
			if (filePath) {
				await this.resizeAndConvert(filePath);
			}
		} catch (error) {
			console.warn(error);
		}
	}

	public abstract resizeAndConvert(filePath: string): Promise<void>;
}
