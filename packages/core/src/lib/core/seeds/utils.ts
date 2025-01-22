import { environment as env } from '@gauzy/config';
import { ApplicationPluginConfig } from '@gauzy/common';
import * as chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';
import * as sharp from 'sharp';
import { getApiPublicPath } from '../util';

/**
 * Retrieves the dimensions of an image file, including SVG files, asynchronously.
 *
 * This function reads the specified image file, determines its dimensions (width and height),
 * and returns them. If an error occurs, it defaults to returning width and height as 0.
 *
 * @param filePath - The path to the image file.
 * @returns A promise resolving to the dimensions of the image as an object containing `width`, `height`, and optionally `type`.
 *          Defaults to `{ width: 0, height: 0 }` if an error occurs.
 */
export const getImageDimensions = async (filePath: string): Promise<sharp.Metadata> => {
	try {
		// Read the image file as a buffer
		const fileBuffer = fs.readFileSync(filePath);

		// Determine the dimensions using the `sharp` library
		const dimensions = await sharp(fileBuffer).metadata();

		// Ensure the result conforms to the `ISize` interface
		return dimensions; // { width: number, height: number, type?: string }
	} catch (error) {
		// Handle errors gracefully
		console.error('Error getting image dimensions:', error);

		// Return default dimensions in case of failure
		return { width: 0, height: 0, size: 0 }; // Default values
	}
};

/**
 * Copy assets from the source directory to the destination directory.
 *
 * @param filename The name of the file to copy.
 * @param config The application configuration.
 * @param destDir The destination directory.
 * @returns The destination file path.
 */
export function copyAssets(
	filename: string,
	config: Partial<ApplicationPluginConfig>,
	destDir: string
): string | undefined {
	if (!destDir) {
		console.warn('WARNING: destDir not found, Please provide a valid destination directory.');
		return undefined;
	}
	try {
		// Check if running in Electron
		const isElectron = env.isElectron;

		// Determine if running from dist or source
		const isDist = __dirname.includes('dist');

		// Default public directory for assets
		const publicDir = getApiPublicPath();

		// Determine the base directory for assets
		const assetPublicPath = isElectron
			? path.resolve(env.gauzyUserPath, 'public')
			: config.assetOptions.assetPublicPath || publicDir;

		// Default seed directory for assets
		const defaultSeedDir = isDist
			? path.resolve(process.cwd(), 'apps/api/src/assets/seed', destDir)
			: path.resolve(__dirname, '../../../apps/api/src/assets/seed', destDir);

		// Custom seed directory for assets
		const customSeedDir = config.assetOptions?.assetPath
			? path.resolve(config.assetOptions.assetPath, 'seed', destDir)
			: defaultSeedDir;

		// Determine the source directory
		const sourceDir = isElectron ? path.join(env.gauzySeedPath, destDir) : customSeedDir;

		// File path
		const filepath = filename.replace(/\\/g, '/');

		// Create directories recursively if they don't exist
		const destinationPath = path.join(assetPublicPath, destDir, filepath);

		// Get destination directory
		const destinationDir = path.dirname(destinationPath);

		// Create directories recursively if they don't exist
		if (!fs.existsSync(destinationDir)) {
			fs.mkdirSync(destinationDir, { recursive: true });
		}

		// copy files from source to destination folder
		const destFilePath = path.join(destDir, filename);

		// Copy files from source to destination folder
		const sourceFilePath = path.join(sourceDir, filename);

		if (fs.existsSync(sourceFilePath)) {
			fs.copyFileSync(sourceFilePath, destinationPath);
			console.log(`Copied: ${sourceFilePath} -> ${destinationPath}`);
			return destFilePath;
		} else {
			console.warn(`Source file does not exist: ${sourceFilePath}`);
			return undefined;
		}
	} catch (error) {
		console.error('Error while copying assets:', error.message);
		return undefined;
	}
}

/**
 * Cleans old seed assets in the specified destination directory.
 * This function removes all files in the target directory except for `rimraf` and `.gitkeep` files.
 *
 * The directory to be cleaned is determined based on whether the application is running
 * in an Electron environment or not.
 *
 * @param config - Partial configuration of the application, including asset options.
 * @param destDir - The destination directory relative to the public assets folder.
 * @returns A Promise that resolves when the cleanup is complete.
 */
export async function cleanAssets(config: Partial<ApplicationPluginConfig>, destDir: string): Promise<void> {
	console.log(chalk.green(`CLEANING UP SEED ASSETS FOR ${destDir}`));

	// Determine the directory to clean based on the environment
	const dir = env.isElectron
		? path.resolve(env.gauzyUserPath, 'public', destDir) // Electron-specific path
		: path.join(config.assetOptions.assetPublicPath, destDir); // Standard path for other environments

	// Delete old files in the directory except for `rimraf` and `.gitkeep`
	await new Promise((resolve, reject) => {
		rimraf(
			`${dir}/!(rimraf|.gitkeep)`,
			() => {
				console.log(chalk.green(`CLEANED UP EVER ICONS: ${dir}`));
				resolve(null); // Resolve on successful cleanup
			},
			() => {
				console.error(chalk.red(`FAILED TO CLEAN EVER ICONS: ${dir}`));
				reject(null); // Reject on failure
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
