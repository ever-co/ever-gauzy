import * as Jimp from 'jimp';
import * as fs from 'fs';
import * as path from 'path';
import { IconGenerator } from '../interfaces/icon-generator';
import { IDesktopIconGenerator } from '../interfaces/i-desktop-icon-generator';
import { IconFactory } from '../icon-factory';

export class DesktopIconGenerator
	extends IconGenerator
	implements IDesktopIconGenerator
{
	constructor() {
		super();
		this.imageUrl = process.env.GAUZY_DESKTOP_LOGO_512X512;
		this.destination = `apps/${this.desktop}/src/icons`;
	}

	private async updateLogoPath(): Promise<void> {
		const source = path.join(this.destination, 'icon.png');
		const destination = `apps/${this.desktop}/src/assets/icons/icon.png`;
		await new Promise((resolve, reject) =>
			fs.copyFile(source, destination, (error) => {
				if (error) {
					console.error(
						'An error occurred while generating the files:',
						error
					);
					reject(error);
				} else {
					process.env.GAUZY_DESKTOP_LOGO_512X512 =
						'assets/icons/icon.png';
					console.log(
						'⛓ - desktop logo 512x512 icons generated successfully!'
					);
					resolve(true);
				}
			})
		);
	}

	public async generateLinuxIcons(originalImage: Jimp): Promise<void> {
		const linuxIconSizes = [512, 256, 128, 64, 32, 16];
		const linuxDestination = path.join(this.destination, 'linux');
		if (!fs.existsSync(linuxDestination)) {
			fs.mkdirSync(linuxDestination);
			console.log('📁 - linux icons directory created!');
		}
		for (const iconSize of linuxIconSizes) {
			const linuxIconFilePath = path.join(
				linuxDestination,
				`${iconSize}x${iconSize}.png`
			);
			await new Promise((resolve) =>
				originalImage
					.clone()
					.resize(iconSize, iconSize)
					.write(linuxIconFilePath, () => {
						console.log(
							`⛓ - ${iconSize}x${iconSize} icon generated`
						);
						resolve(true);
					})
			);
		}
	}

	public async generateMacIcon(originalImage: Jimp): Promise<void> {
		const macIconFilePath = path.join(this.destination, 'icon.icns');
		await new Promise((resolve) =>
			originalImage.clone().write(macIconFilePath, () => {
				console.log('⛓ - Image converted to ICNS format successfully.');
				resolve(true);
			})
		);
	}

	public async generateWindowsIcon(originalImage: Jimp): Promise<void> {
		const windowsIconFilePath = path.join(this.destination, 'icon.ico');
		await new Promise((resolve) =>
			originalImage
				.clone()
				.resize(256, 256)
				.write(windowsIconFilePath, () => {
					console.log(
						'⛓ - Image converted to ICO format successfully.'
					);
					resolve(true);
				})
		);
	}

	public async resizeAndConvert(filePath: string): Promise<void> {
		const image = await Jimp.read(filePath);
		const pngFilePath = path.join(this.destination, 'icon.png');
		await new Promise((resolve) =>
			image
				.clone()
				.resize(512, 512)
				.write(pngFilePath, () => {
					console.log(
						'⛓ - Image converted to PNG format successfully.'
					);
					resolve(true);
				})
		);

		await this.generateLinuxIcons(image);
		await this.generateMacIcon(image);
		await this.generateWindowsIcon(image);
	}

	public async generate(): Promise<void> {
		try {
			const filePath = await this.downloadImage();
			if (filePath) {
				await this.resizeAndConvert(filePath);
				this.remove(filePath);
			} else {
				await IconFactory.generateDefaultIcons();
			}
			await this.updateLogoPath();
		} catch (error) {
			console.warn(error);
		}
	}
}
