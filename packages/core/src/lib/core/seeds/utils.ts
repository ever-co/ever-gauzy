import { ApplicationPluginConfig } from '@gauzy/common';
import { environment as env } from '@gauzy/config';
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';

/**
 * Copy assets from the source directory to the destination directory.
 *
 * @param filename The name of the file to copy.
 * @param config The application configuration.
 * @param destDir The destination directory.
 * @returns The destination file path.
 */
export function copyAssets(filename: string, config: Partial<ApplicationPluginConfig>, destDir: string = 'ever-icons') {
	try {
		// Check if electron
		const isElectron = env.isElectron;
		// Default public directory for assets
		const publicDir = path.resolve(__dirname, '../../../', ...['apps', 'api', 'public']);

		// Default seed directory for assets
		const defaultSeedDir = path.resolve(
			__dirname,
			'../../../',
			...['apps', 'api', 'src', 'assets', 'seed', destDir]
		);

		// Custom seed directory for assets
		const customSeedDir = path.join(config.assetOptions.assetPath, ...['seed', destDir]);

		// Base directory for assets
		const dir = isElectron ? path.join(env.gauzySeedPath, destDir) : customSeedDir || defaultSeedDir;

		// Custom public directory for assets
		const assetPublicPath = config.assetOptions.assetPublicPath;

		// Base directory for assets
		const baseDir = isElectron ? path.resolve(env.gauzyUserPath, ...['public']) : assetPublicPath || publicDir;

		// File path
		const filepath = filename.replace(/\\/g, '/');

		// Create folders all the way down
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

		// Return the destination file path
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
				console.log(chalk.green(`CLEANED UP EVER ICONS: ${dir}`));
				resolve(null);
			},
			() => {
				reject(null);
			}
		);
	});
}

/**
 * Takes an email string, converts it to lowercase, and appends a postfix "_ever_testing" before the "@" symbol.
 *
 * @param email The email address to modify.
 * @param postfix The postfix to append (default is "_ever_testing").
 * @returns The modified email address with the postfix appended before the "@" symbol.
 */
export function getEmailWithPostfix(email: string, postfix = '_ever_testing'): string {
	const atIndex = email.indexOf('@');
	if (atIndex === -1) {
		// If "@" symbol not found, return original email
		return email;
	}
	const localPart = email.slice(0, atIndex); // Extract local part before "@"
	const domainPart = email.slice(atIndex); // Extract domain part including "@"
	const lowercaseLocalPart = localPart.toLowerCase();
	return lowercaseLocalPart + postfix + domainPart;
}
