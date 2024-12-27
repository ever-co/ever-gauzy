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

	/**
	 * Returns the singleton instance of the DesktopEnvironmentManager.
	 *
	 * If the instance does not exist, it creates a new one.
	 *
	 * @returns {DesktopEnvironmentManager} The singleton instance.
	 */
	private static get instance(): DesktopEnvironmentManager {
		if (!this._instance) {
			this._instance = new DesktopEnvironmentManager(); // Lazy initialization
		}
		return this._instance;
	}

	/**
	 * Retrieves the environment configuration from the file system.
	 *
	 * This method checks if the environment file exists. If it does, it dynamically
	 * imports and returns the environment configuration. If the file does not exist,
	 * it returns null.
	 *
	 * @returns {any | null} The environment configuration object or null if the file is not found.
	 */
	public static get environment(): any | null {
		const filePath = path.join(this.instance.fileDir, `${this.instance.fileName}.ts`);

		if (!fs.existsSync(filePath)) {
			console.warn(`⚠ Environment file not found at: ${filePath}`);
			return null;
		}

		try {
			// Dynamically import the environment file
			const environmentPath = path.resolve('..', '..', this.instance.fileDir, this.instance.fileName);
			const loadedEnvironment = require(environmentPath);
			// Return the environment object
			return loadedEnvironment.environment;
		} catch (error) {
			console.error(`✖ Error loading environment file (${filePath}): ${error.message}`);
			return null;
		}
	}

	/**
	 * Updates the environment file with the current environment configuration.
	 * If the file exists, it deletes the old file and writes a new one with the updated content.
	 * If the file does not exist, logs a warning message.
	 *
	 * @throws {Error} Logs an error message if the file operation fails.
	 * @returns {void}
	 */
	public static update(): void {
		const environment: IDesktopEnvironment = { ...this.environment };
		const filePath = path.join(this.instance.fileDir, `${this.instance.fileName}.ts`);

		try {
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath); // Remove the existing file
				const content = this.instance.content(environment, this.instance.isProd).trim(); // Ensure no extra whitespace
				fs.writeFileSync(filePath, content); // Write the updated content
				console.log(`✔ Environment file updated: ${filePath}`);
			} else {
				console.warn(`⚠ File does not exist: ${filePath}`);
			}
		} catch (error) {
			console.error(`✖ Error updating environment file (${filePath}): ${error.message}`);
		}
	}


	/**
	 * Generates environment files for production and development.
	 *
	 * This method creates or updates the `environment.prod.ts` and `environment.ts` files
	 * with the provided environment variables. Existing files are removed before being recreated.
	 * Logs the status of the operation to the console.
	 *
	 * @throws {Error} Logs an error message if the file operation fails.
	 * @returns {void}
	 */
	public static generate(): void {
		const files = [
			{ name: 'environment.prod.ts', isProd: true },
			{ name: 'environment.ts', isProd: false }
		];

		const environment: Partial<IDesktopEnvironment> = { ...env };

		files.forEach(({ name, isProd }) => {
			const filePath = path.join(this.instance.fileDir, name);

			try {
				// Remove existing file if it exists
				if (fs.existsSync(filePath)) {
					fs.unlinkSync(filePath);
				}

				// Write new environment file
				const content = this.instance.content(environment, isProd);
				fs.writeFileSync(filePath, content);

				console.log(`✔ Generated desktop ${isProd ? 'production' : 'development'} environment file: ${filePath}`);
			} catch (error) {
				console.error(`✖ Error generating environment file (${name}): ${error.message}`);
			}
		});
	}

	/**
	 * Generates the content of the environment file as a string.
	 *
	 * This method dynamically generates the environment file content based on the provided
	 * environment variables and production flag. It ensures a valid JavaScript object structure.
	 *
	 * @param {Partial<IDesktopEnvironment>} variable - The environment variables to include in the file.
	 * @param {boolean} isProd - Specifies if the environment is for production.
	 * @returns {string} The formatted environment content string.
	 */
	public content(variable: Partial<IDesktopEnvironment>, isProd: boolean): string {
		const environmentContent = DesktopEnvironmentContentFactory.generate(this.desktop, variable);

		return `export const environment = {
			production: ${isProd},
			${environmentContent}
		};`.trim();
	}
}

DesktopEnvironmentManager.update();
