import { IIconGeneratorBase } from '../interfaces/i-icon-generator-base';
import * as fs from 'fs';
import { argv } from 'yargs';
import { env } from '../../env';

export class DesktopDefaultIconGenerator implements IIconGeneratorBase {
	private readonly desktop: string;
	private readonly destination: string;
	private readonly source: string;

	constructor() {
		this.desktop = String(argv.desktop);
		this.destination = `apps/${this.desktop}/src/icons`;
		this.source = `.scripts/icon-utils/icons`;
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
							'An error occurred while generating the files:',
							error
						);
						reject(error);
					}
					process.env.GAUZY_DESKTOP_LOGO_512X512 =
						env.GAUZY_DESKTOP_LOGO_512X512;
					process.env.PLATFORM_LOGO_URL = env.PLATFORM_LOGO_URL;
					process.env.NO_INTERNET_LOGO = env.NO_INTERNET_LOGO;
					console.log('⛓ - default icons generated successfully!');
					resolve(true);
				}
			)
		);
	}
}
