import { ApplicationPluginConfig } from '@gauzy/common';
import { environment as env } from '@gauzy/config';
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';

/**
 * Copy ever icons
 *
 * @param fileName
 * @param config
 * @returns
 */
export function copyAssets(filename: string, config: Partial<ApplicationPluginConfig>, destDir: string = 'ever-icons') {
	try {
		const dir = env.isElectron
			? path.join(env.gauzySeedPath, destDir)
			: path.join(config.assetOptions.assetPath, ...['seed', destDir]) ||
			path.resolve(__dirname, '../../../', ...['apps', 'api', 'src', 'assets', 'seed', destDir]);

		const baseDir = env.isElectron
			? path.resolve(env.gauzyUserPath, ...['public'])
			: config.assetOptions.assetPublicPath || path.resolve(__dirname, '../../../', ...['apps', 'api', 'public']);
		const filepath = filename.replace(/\\/g, '/');
		// create folders all the way down
		const folders = filepath.split('/').slice(0, -1); // remove last item, filename
		folders.reduce((acc, folder) => {
			const folderPath = path.join(acc, folder);
			if (!fs.existsSync(folderPath)) {
				fs.mkdirSync(folderPath, { recursive: true });
			}
			return folderPath;
		}, path.join(baseDir, destDir));

		// copy files from source to destination folder
		const destFilePath = path.join(destDir, filename);
		fs.copyFileSync(path.join(dir, filename), path.join(baseDir, destFilePath));
		return destFilePath;
	} catch (error) {
		console.log('Error while copy ever icons for seeder', error);
	}
}

/**
 * Clean old ever icons
 *
 * @param config
 * @param destDir
 */
export async function cleanAssets(config: Partial<ApplicationPluginConfig>, destDir: string) {
	console.log(chalk.green(`CLEANING UP SEED ASSETS FOR ${destDir}`));

	await new Promise((resolve, reject) => {
		const dir = env.isElectron
			? path.resolve(env.gauzyUserPath, ...['public', destDir])
			: path.join(config.assetOptions.assetPublicPath, destDir);

		// delete old generated ever icons
		rimraf(
			`${dir}/!(rimraf|.gitkeep)`,
			() => {
				console.log(chalk.green(`CLEANED UP EVER ICONS`));
				resolve(null);
			},
			() => {
				reject(null);
			}
		);
	});
}

/**
 * Takes an email string, converts it to lowercase, and appends a postfix "_ever_testing".
 *
 * @param email The email address to modify.
 * @param postfix The postfix to append (default is "_ever_testing").
 * @returns The modified email address with the postfix appended.
 */
export function getEmailWithPostfix(email: string, postfix = '_ever_testing'): string {
	const lowercaseEmail = email.toLowerCase();
	return lowercaseEmail + postfix;
}
