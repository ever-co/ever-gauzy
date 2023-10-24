import * as Jimp from 'jimp';
import { IIconGenerator } from './i-icon-generator';

export interface IDesktopIconGenerator extends IIconGenerator {
	generateLinuxIcons(originalImage: Jimp): Promise<void>;

	generateWindowsIcon(originalImage: Jimp): Promise<void>;

	generateMacIcon(originalImage: Jimp): Promise<void>;

	generateTrayIcon(originalImage: Jimp): Promise<void>;
}
