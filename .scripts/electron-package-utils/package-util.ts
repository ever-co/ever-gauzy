import * as fs from 'fs';
import { argv } from 'yargs';
import * as path from 'path';
import { IPackage } from './interfaces/i-package';
import { PackagerFactory } from './packager-factory';

export class PackageUtil {
	private static _instance: PackageUtil;
	private readonly filePath: string;
	private readonly desktop: string;

	constructor() {
		this.desktop = String(argv.desktop);
		this.filePath = path.join('apps', this.desktop, 'src', 'package.json');
	}

	private static get instance(): PackageUtil {
		if (!this._instance) {
			this._instance = new PackageUtil();
		}
		return this._instance;
	}

	public static get package(): IPackage {
		if (fs.existsSync(this.instance.filePath)) {
			return JSON.parse(
				fs.readFileSync(this.instance.filePath, { encoding: 'utf8' })
			);
		}
		console.warn(`WARNING: File ${this.instance.filePath} doesn't exists.`);
		return null;
	}

	public static update(): void {
		const pkg = this.package;
		if (pkg) {
			const packager = PackagerFactory.packager(this.instance.desktop);
			const packed = packager.prepare(pkg);
			fs.writeFileSync(
				this.instance.filePath,
				JSON.stringify(packed, null, 4)
			);
			console.warn('✔ package updated.');
			return;
		}
		console.warn('WARNING: Package not updated.');
	}
}

// Update package.json
PackageUtil.update();
