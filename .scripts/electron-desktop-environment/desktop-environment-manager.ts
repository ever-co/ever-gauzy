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
		const environment = this.environment;
		const filePath = path.join(
			this.instance.fileDir,
			this.instance.fileName.concat(`.ts`)
		);
		if (fs.existsSync(filePath) && environment) {
			fs.unlinkSync(filePath);
			fs.writeFileSync(filePath, this.instance.content(environment));
			console.log(`✔ environment ${filePath} updated.`);
			return;
		}
		console.log(`WARNING: file ${filePath} does not exists.`);
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
