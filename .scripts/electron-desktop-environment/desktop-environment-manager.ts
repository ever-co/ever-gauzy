import { DesktopEnvironmentContentFactory } from './desktop-environment-content-factory';
import { argv } from 'yargs';
import * as path from 'path';
import * as fs from 'fs';
import { env } from '../env';
import { IDesktopEnvironment } from './interfaces/i-desktop-environment';

export class DesktopEnvironmentManager {
	private static _instance: DesktopEnvironmentManager;
	private readonly desktop: string;
	private readonly fileDir: string;
	private readonly fileName: string;
	private readonly isProd: boolean;

	protected constructor() {
		this.desktop = String(argv.desktop);
		this.isProd = argv.environment === 'prod';
		this.fileName = this.isProd ? 'environment.prod' : 'environment';
		this.fileDir = path.join('apps', this.desktop, 'src', 'environments');
	}

	private static get instance(): DesktopEnvironmentManager {
		if (!this._instance) {
			this._instance = new DesktopEnvironmentManager();
		}
		return this._instance;
	}

	public static get environment(): any {
		if (
			fs.existsSync(
				path.join(
					this.instance.fileDir,
					this.instance.fileName.concat(`.ts`)
				)
			)
		) {
			return require(path.join(
				'..',
				'..',
				this.instance.fileDir,
				this.instance.fileName
			)).environment;
		}
		return null;
	}

	public static update(): void {
		const environment: IDesktopEnvironment = Object.assign(
			{},
			this.environment
		);
		const filePath = path.join(
			this.instance.fileDir,
			this.instance.fileName.concat(`.ts`)
		);
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
			fs.writeFileSync(
				filePath,
				this.instance.content(environment, this.instance.isProd)
			);
			console.log(`✔ environment ${filePath} updated.`);
			return;
		}
		console.log(`WARNING: file ${filePath} does not exists.`);
	}

	public static generate(): void {
		const files = ['environment.prod.ts', 'environment.ts'];
		const environment: Partial<IDesktopEnvironment> = Object.assign({}, env);
		for (const file of files) {
			const isProd = file === 'environment.prod.ts';
			const filePath = path.join(this.instance.fileDir, file);
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
			fs.writeFileSync(filePath, this.instance.content(environment, isProd));
			console.log(
				`✔ Generated desktop ${isProd} environment file: ${filePath}`
			);
		}
	}

	public content(variable: Partial<IDesktopEnvironment>, isProd: boolean) {
		return `export const environment = {
			production: ${isProd},
			${DesktopEnvironmentContentFactory.generate(this.desktop, variable)}
		}`;
	}
}

DesktopEnvironmentManager.update();
