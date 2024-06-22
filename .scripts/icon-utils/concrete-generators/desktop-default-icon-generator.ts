import { IIconGeneratorBase } from '../interfaces/i-icon-generator-base';
import * as fs from 'fs';
import { argv } from 'yargs';
import { env } from '../../env';
import * as path from 'path';
import { DesktopEnvironmentManager } from '../../electron-desktop-environment/desktop-environment-manager';

export class DesktopDefaultIconGenerator implements IIconGeneratorBase {
	private readonly desktop: string;
	private readonly destination: string;
	private readonly source: string;

	constructor() {
		this.desktop = String(argv.desktop);
		this.destination = path.join('apps', this.desktop, 'src', 'icons');
		this.source = path.join('.scripts', 'icon-utils', 'icons');
	}

	public async generate(): Promise<void> {
		await new Promise((resolve, reject) =>
			fs.cp(
				this.source,
				this.destination,
				{ recursive: true },
				(error) => {
					if (error) {
						console.error(
							'ERROR: An error occurred while generating the files:',
							error
						);
						reject(error);
						return;
					}
					DesktopEnvironmentManager.environment.I4NET_DESKTOP_LOGO_512X512 =
						env.I4NET_DESKTOP_LOGO_512X512;
					DesktopEnvironmentManager.environment.PLATFORM_LOGO =
						env.PLATFORM_LOGO;
					DesktopEnvironmentManager.environment.NO_INTERNET_LOGO =
						env.NO_INTERNET_LOGO;
					console.log('✔ default icons generated successfully!');
					resolve(true);
				}
			)
		);
	}
}
