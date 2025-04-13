import { IIconGeneratorBase } from '../interfaces/i-icon-generator-base';
import * as fs from 'fs';
import { argv } from 'yargs';
import * as path from 'path';

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
					console.log('✔ default icons generated successfully!');
					resolve(true);
				}
			)
		);
	}
}
