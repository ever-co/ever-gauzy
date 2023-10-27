import * as dotenv from 'dotenv';
import { PlatformLogoGenerator } from './concrete-generators/platform-logo-generator';
import { DesktopIconGenerator } from './concrete-generators/desktop-icon-generator';
import { DesktopDefaultIconGenerator } from './concrete-generators/desktop-default-icon-generator';
import { NoInternetLogoGenerator } from './concrete-generators/no-internet-logo-generator';
import { DesktopEnvironmentManager } from '../electron-desktop-environment/desktop-environment-manager';

dotenv.config();

export class IconFactory {
	public static async generateDefaultIcons(): Promise<void> {
		const defaultIcon = new DesktopDefaultIconGenerator();
		await defaultIcon.generate();
	}

	public static async generatePlatformLogo(): Promise<void> {
		const platformLogo = new PlatformLogoGenerator();
		await platformLogo.generate();
	}

	public static async generateDesktopIcons(): Promise<void> {
		const desktopIcon = new DesktopIconGenerator();
		await desktopIcon.generate();
	}

	public static async generateNoInternetLogo(): Promise<void> {
		const noInternetLogo = new NoInternetLogoGenerator();
		await noInternetLogo.generate();
	}
}

(async () => {
	//Generate platform logo from URL
	await IconFactory.generatePlatformLogo();
	//Generate platform logo from URL
	await IconFactory.generateNoInternetLogo();
	//Generate desktop icons from URL
	await IconFactory.generateDesktopIcons();
	// Update environment file
	DesktopEnvironmentManager.update();
})();
