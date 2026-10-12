import { Jimp, ResizeStrategy } from 'jimp';
import * as fs from 'fs';
import * as path from 'path';
import { IconGenerator } from '../interfaces/icon-generator';
import { IDesktopIconGenerator, JimpImage } from '../interfaces/i-desktop-icon-generator';
import { IconFactory } from '../icon-factory';
import { env } from '../../env';
import * as PngIco from 'png-to-ico';
import { DesktopEnvironmentManager } from '../../electron-desktop-environment/desktop-environment-manager';

export class DesktopIconGenerator
	extends IconGenerator
	implements IDesktopIconGenerator {
	constructor() {
		super();
		this.imageUrl = env.GAUZY_DESKTOP_LOGO_512X512;
		this.trayIconImageUrl = env.GAUZY_DESKTOP_TRAY_ICON;
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
					DesktopEnvironmentManager.environment.GAUZY_DESKTOP_LOGO_512X512 =
						'./assets/icons/desktop_logo_512x512.png';
					console.log(
						'✔ desktop logo 512x512 icons generated successfully.'
					);
					resolve(true);
				}
			})
		);
	}

	public async generateLinuxIcons(originalImage: JimpImage): Promise<void> {
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
			// jimp 1: `write` is promise-based and needs a path with a known extension.
			await originalImage
				.clone()
				.resize({ w: iconSize, h: iconSize })
				.write(linuxIconFilePath as `${string}.png`);
			console.log(`✔ linux ${iconSize}x${iconSize}.png icon generated.`);
		}
	}

	public async generateMacIcon(originalImage: JimpImage): Promise<void> {
		const macIconFilePath = path.join(this.destination, 'icon.icns');
		// jimp has no ICNS encoder: jimp 0.x reported that to a callback that ignored it, so no icon.icns was ever
		// written here and the build went on. Kept as it was (attempted, and a failure does not stop the build), only
		// now the failure is logged.
		try {
			await originalImage.clone().write(macIconFilePath as `${string}.png`);
			console.log('✔ macOS icon.icns generated.');
		} catch (error) {
			console.warn(`macOS icon.icns not generated: ${error?.message ?? error}`);
		}
	}

	public async generateWindowsIcon(originalImage: JimpImage): Promise<void> {
		const ICON_SIZE = 256;
		const png = `icon_${ICON_SIZE}x${ICON_SIZE}.png`;
		const ico = 'icon.ico';
		const windowsTempIconFilePath = path.join(this.destination, png);
		const windowsIconFilePath = path.join(this.destination, ico);
		await originalImage
			.clone()
			.resize({ w: ICON_SIZE, mode: ResizeStrategy.NEAREST_NEIGHBOR })
			.write(windowsTempIconFilePath as `${string}.png`);
		const buffer = await PngIco([windowsTempIconFilePath]);
		fs.writeFileSync(windowsIconFilePath, buffer);
		await this.remove(windowsTempIconFilePath, true);
		console.log(`✔ window ${ico} generated.`);
	}

	public async generateTrayIcon(originalImage: JimpImage): Promise<void> {
		const REF_SIZE = 16;
		const colors = ['gray', 'normal'];
		const grayColor = '#999999';
		const scales = [1, 1.25, 1.33, 1.4, 1.5, 1.8, 2, 2.5, 3, 4, 5];
		const pngFilePath = path.join(
			'apps',
			this.desktop,
			'src',
			'assets',
			'icons',
			'tray'
		);
		for (const color of colors) {
			for (const scale of scales) {
				const size = REF_SIZE * scale;
				const suffix = color === 'gray' ? '_gray' : '';
				const scalePart = scale === scales[0] ? '' : `@${scale}x`;

				const icon = `icon${scalePart}${suffix}.png`;
				const imgJimp = originalImage.clone().resize({ w: size, h: size });
				if (color === 'gray') {
					imgJimp.color([
						{
							apply: 'mix' as any,
							params: [grayColor, 60]
						}
					]);
					imgJimp.greyscale();
					imgJimp.brightness(-0.1);
				}
				await imgJimp.write(path.join(pngFilePath, icon) as `${string}.png`);
				console.log(`✔ tray icon ${icon} generated successfully.`);
			}
		}

	}

	public async generateMenuIcon(originalImage: JimpImage): Promise<void> {
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
				.resize({ w: iconSize, mode: ResizeStrategy.NEAREST_NEIGHBOR })
				.write(menuIconFilePath as `${string}.png`);
			console.log(`✔ menu ${png} generated.`);
		}
	}

	public async resizeAndConvert(filePath: string, trayIconFilePath?: string): Promise<void> {
		const image = await Jimp.read(filePath);

		const pngFilePath = path.join(this.destination, 'icon.png');
		await image
			.clone()
			.resize({ w: 512, h: 512 })
			.write(pngFilePath as `${string}.png`);
		console.log('✔ image converted to PNG format successfully.');

		await this.generateLinuxIcons(image);
		await this.generateMacIcon(image);
		await this.generateWindowsIcon(image);
		if (trayIconFilePath) {
			const trayImage = await Jimp.read(trayIconFilePath);
			await this.generateTrayIcon(trayImage);
		} else {
			await this.generateTrayIcon(image);
		}
		await this.generateMenuIcon(image);
	}

	public async generate(): Promise<void> {
		try {
			const filePath = await this.downloadImage();
			const trayIconFilePath = await this.downloadTrayImage();
			if (filePath) {
				await this.resizeAndConvert(filePath, trayIconFilePath || '');
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
