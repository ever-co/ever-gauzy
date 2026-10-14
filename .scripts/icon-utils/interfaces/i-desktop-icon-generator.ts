import { Jimp } from 'jimp';
import { IIconGenerator } from './i-icon-generator';

/** An image as jimp 1 reads it (jimp 1 exports the class, not an instance type). */
export type JimpImage = Awaited<ReturnType<typeof Jimp.read>>;

export interface IDesktopIconGenerator extends IIconGenerator {
	generateLinuxIcons(originalImage: JimpImage): Promise<void>;

	generateWindowsIcon(originalImage: JimpImage): Promise<void>;

	generateMacIcon(originalImage: JimpImage): Promise<void>;

	generateTrayIcon(originalImage: JimpImage): Promise<void>;

	generateMenuIcon(originalImage: JimpImage): Promise<void>;
}
