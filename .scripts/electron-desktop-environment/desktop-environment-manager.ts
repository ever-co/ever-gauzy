import { DesktopEnvironmentContentFactory } from './desktop-environment-content-factory';
import { argv } from 'yargs';
import * as path from 'path';
import * as fs from 'fs';
import { env, Env } from '../env';

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
		if (
			fs.existsSync(path.join(this.fileDir, this.fileName.concat(`.ts`)))
		) {
			this._environment = require(path.join(
				'..',
				'..',
				this.fileDir,
				this.fileName
			)).environment;
		}
	}

	private static get instance(): DesktopEnvironmentManager {
		if (!this._instance) {
			this._instance = new DesktopEnvironmentManager();
		}
		return this._instance;
	}

	private _environment: any;

	public static get environment(): any {
		return this.instance._environment;
	}

	public static update(): void {
		const filePath = path.join(
			this.instance.fileDir,
			this.instance.fileName.concat(`.ts`)
		);
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
		}
		fs.writeFileSync(filePath, this.instance.content(this.environment));
		console.log(`✔ environment ${filePath} updated.`);
	}

	public static generate(): void {
		const files = ['environment.prod.ts', 'environment.ts'];
		for (const file of files) {
			const filePath = path.join(this.instance.fileDir, file);
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
			fs.writeFileSync(filePath, this.instance.content(env));
			console.log(
				`✔ Generated desktop ${
					file === 'environment.prod.ts'
						? 'production'
						: 'development'
				} environment file: ${filePath}`
			);
		}
	}

	public content(variable: Env) {
		return `export const environment = {
			production: '${this.isProd}',
			${DesktopEnvironmentContentFactory.generate(this.desktop, variable)}
		}`;
	}
}
