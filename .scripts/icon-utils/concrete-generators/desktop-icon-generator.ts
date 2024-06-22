import * as Jimp from 'jimp';
import * as fs from 'fs';
import * as path from 'path';
import { IconGenerator } from '../interfaces/icon-generator';
import { IDesktopIconGenerator } from '../interfaces/i-desktop-icon-generator';
import { IconFactory } from '../icon-factory';
import { env } from '../../env';
import * as PngIco from 'png-to-ico';
import { DesktopEnvironmentManager } from '../../electron-desktop-environment/desktop-environment-manager';

export class DesktopIconGenerator
	extends IconGenerator
	implements IDesktopIconGenerator {
	constructor() {
		super();
		this.imageUrl = env.I4NET_DESKTOP_LOGO_512X512;
		this.destination = path.join('apps', this.desktop, 'src', 'icons');
	}

	private async updateLogoPath(): Promise<void> {
		const source = path.join(this.destination, 'icon.png');
		const destination = path.join(
			'apps',
			this.desktop,
			'src',
			'assets',
			'icons',
			'desktop_logo_512x512.png'
		);
		await new Promise((resolve, reject) =>
			fs.copyFile(source, destination, (error) => {
				if (error) {
					console.error(
						'ERROR: An error occurred while generating the files:',
						error
					);
					reject(error);
				} else {
					DesktopEnvironmentManager.environment.I4NET_DESKTOP_LOGO_512X512 =
						'./assets/icons/desktop_logo_512x512.png';
					console.log(
						'✔ desktop logo 512x512 icons generated successfully.'
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
			console.log('✔ linux icons directory created.');
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
							`✔ linux ${iconSize}x${iconSize}.png icon generated.`
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
				console.log('✔ macOS icon.icns generated.');
				resolve(true);
			})
		);
	}

	public async generateWindowsIcon(originalImage: Jimp): Promise<void> {
		const ICON_SIZE = 256;
		const png = `icon_${ICON_SIZE}x${ICON_SIZE}.png`;
		const ico = 'icon.ico';
		const windowsTempIconFilePath = path.join(this.destination, png);
		const windowsIconFilePath = path.join(this.destination, ico);
		await originalImage
			.clone()
			.resize(ICON_SIZE, Jimp.AUTO, Jimp.RESIZE_NEAREST_NEIGHBOR)
			.writeAsync(windowsTempIconFilePath);
		const buffer = await PngIco([windowsTempIconFilePath]);
		fs.writeFileSync(windowsIconFilePath, buffer);
		await this.remove(windowsTempIconFilePath, true);
		console.log(`✔ window ${ico} generated.`);
	}

	public async generateTrayIcon(originalImage: Jimp): Promise<void> {
		const REF_SIZE = 16;
		const scales = [1, 1.25, 1.33, 1.4, 1.5, 1.8, 2, 2.5, 3, 4, 5];
		const pngFilePath = path.join(
			'apps',
			this.desktop,
			'src',
			'assets',
			'icons',
			'tray'
		);
		for (const scale of scales) {
			const size = REF_SIZE * scale;
			const icon =
				scale === scales[0] ? 'icon.png' : `icon@${scale}x.png`;
			await new Promise((resolve) =>
				originalImage
					.clone()
					.resize(size, size)
					.write(path.join(pngFilePath, icon), () => {
						console.log(
							`✔ tray icon ${icon} generated successfully.`
						);
						resolve(true);
					})
			);
		}
	}

	public async generateMenuIcon(originalImage: Jimp): Promise<void> {
		const iconSizes = [512, 256, 192, 128, 96, 64, 48, 40, 32, 24, 20, 16];
		// Remove 512x512 pixels for windows apps
		if (process.platform === 'win32') {
			iconSizes.shift();
		}
		const destination = path.join(
			'apps',
			this.desktop,
			'src',
			'assets',
			'icons',
			'menu'
		);
		for (const iconSize of iconSizes) {
			const png = iconSize === iconSizes[0] ? 'icon.png' : `icon_${iconSize}x${iconSize}.png`;
			const menuIconFilePath = path.join(destination, png);
			await originalImage
				.clone()
				.resize(iconSize, Jimp.AUTO, Jimp.RESIZE_NEAREST_NEIGHBOR)
				.writeAsync(menuIconFilePath);
			console.log(`✔ menu ${png} generated.`);
		}
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
						'✔ image converted to PNG format successfully.'
					);
					resolve(true);
				})
		);

		await this.generateLinuxIcons(image);
		await this.generateMacIcon(image);
		await this.generateWindowsIcon(image);
		await this.generateTrayIcon(image);
		await this.generateMenuIcon(image);
	}

	public async generate(): Promise<void> {
		try {
			const filePath = await this.downloadImage();
			if (filePath) {
				await this.resizeAndConvert(filePath);
				await this.remove(filePath);
			} else {
				await IconFactory.generateDefaultIcons();
			}
			await this.updateLogoPath();
		} catch (error) {
			console.error(error);
		}
	}
}
