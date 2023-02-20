import * as fs from "fs";
import * as path from 'path';
import * as chalk from 'chalk';
import * as rimraf from 'rimraf';
import { IPluginConfig } from "@gauzy/common";
import { environment as env } from '@gauzy/config';

/**
 * Copy ever icons
 *
 * @param fileName
 * @param config
 * @returns
 */
export function copyEverIcons(
    filename: string,
    config: Partial<IPluginConfig>,
    destDir: string = 'ever-icons'
) {
    try {
        const dir = env.isElectron
            ? path.resolve(
                env.gauzyUserPath,
                ...['src', 'assets', 'seed', destDir]
            )
            : path.join(config.assetOptions.assetPath, ...['seed', destDir]) ||
            path.resolve(
                __dirname,
                '../../../',
                ...['apps', 'api', 'src', 'assets', 'seed', destDir]
            );

        const baseDir = env.isElectron
            ? path.resolve(env.gauzyUserPath, ...['public'])
            : config.assetOptions.assetPublicPath ||
            path.resolve(
                __dirname,
                '../../../',
                ...['apps', 'api', 'public']
            );

        const filepath = filename.replace(/\\/g, '/');
        // create folders all the way down
        const folders = filepath.split('/').slice(0, -1);  // remove last item, filename
        folders.reduce(
            (acc, folder) => {
                const folderPath = path.join(acc, folder);
                if (!fs.existsSync(folderPath)) {
                    fs.mkdirSync(folderPath, { recursive: true });
                }
                return folderPath
            },
            path.join(baseDir, destDir)
        );

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
export async function cleanEverIcons(
    config: Partial<IPluginConfig>,
    destDir: string
) {
    console.log(chalk.green(`CLEANING UP EVER ICONS...`));

    await new Promise((resolve, reject) => {
        const dir = env.isElectron
            ? path.resolve(env.gauzyUserPath, ...['public', destDir])
            : path.join(config.assetOptions.assetPublicPath, destDir);

        // delete old generated ever iconss
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
