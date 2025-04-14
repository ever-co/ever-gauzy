import { IconGenerator } from '../interfaces/icon-generator';
import { IIconGenerator } from '../interfaces/i-icon-generator';
import * as path from 'path';
import * as fs from 'fs';

export class NoInternetLogoGenerator extends IconGenerator implements IIconGenerator {
	constructor() {
		super();
		this.imageUrl = 'assets/images/logos/dspot_erp_light.svg';
		this.destination = path.join('apps', this.desktop ?? 'desktop', 'src', 'assets', 'images', 'logos');
	}

	public async resizeAndConvert(filePath: string): Promise<void> {
		const extName = path.extname(this.imageUrl);
		const noInternetLogoFilePath = path.join(this.destination, `no_internet_logo${extName}`);
		await new Promise((resolve, reject) => {
			fs.copyFile(filePath, noInternetLogoFilePath, async (err) => {
				if (err) {
					console.error('ERROR: An error occurred while generating the files:', err);
					reject(err);
					return;
				}
				// remove downloaded file
				await this.remove(filePath);
				console.log(`✔ ${extName} copied successfully.`);
				resolve(true);
			});
		});
	}
}
