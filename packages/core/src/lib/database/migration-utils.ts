import * as fs from 'fs';
import * as path from 'path';
import { mkdirp } from 'mkdirp';

/**
 * Migration utils functions.
 * From https://github.com/typeorm/typeorm/blob/2bb0e398f922561f1cbb8ebbb19d20aa093e8bc2/src/commands/MigrationGenerateCommand.ts
 */
export class MigrationUtils {
	/**
	 * Creates directories recursively.
	 *
	 * @param directory - The directory path to create.
	 * @returns {Promise<void>} - Resolves when the directory is created.
	 */
	static createDirectories(directory: string): Promise<void> {
		return new Promise<void>(async (resolve, reject) => {
			try {
				await mkdirp(directory);
				resolve();
			} catch (err) {
				return reject(err);
			}
		});
	}

	/**
	 * Creates a file with the given content at the specified path.
	 *
	 * @param filePath - The full path of the file to create.
	 * @param content - The content to write to the file.
	 * @param override - If `false`, does not overwrite existing files. Default is `true`.
	 * @returns {Promise<void>} - Resolves when the file is successfully created.
	 */
	static async createFile(filePath: string, content: string, override: boolean = true): Promise<void> {
		await MigrationUtils.createDirectories(path.dirname(filePath));
		return new Promise<void>((resolve, reject) => {
			if (override === false && fs.existsSync(filePath)) return resolve();

			fs.writeFile(filePath, content, (err) => (err ? reject(err) : resolve()));
		});
	}

	/**
	 * Reads the content of a file as a string.
	 *
	 * @param filePath - The path of the file to read.
	 * @returns {Promise<string>} - Resolves with the content of the file.
	 */
	static async readFile(filePath: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			fs.readFile(filePath, (err, data) => (err ? reject(err) : resolve(data.toString())));
		});
	}

	/**
     * Checks if a file exists at the specified path.
     *
     * @param filePath - The path of the file to check.
     * @returns {boolean} - `true` if the file exists, otherwise `false`.
     */
	static async fileExists(filePath: string): Promise<boolean> {
		return fs.existsSync(filePath);
	}
}
