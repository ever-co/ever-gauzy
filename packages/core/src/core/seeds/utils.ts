import * as fs from "fs";
import * as path from 'path';
import { copyFileSync, mkdirSync } from 'fs';
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
    fileName: string,
    config: Partial<IPluginConfig>
) {
    try {
        const destDir = 'ever-icons';

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

        mkdirSync(path.join(baseDir, destDir), { recursive: true });

        const destFilePath = path.join(destDir, fileName);
        copyFileSync(path.join(dir, fileName), path.join(baseDir, destFilePath));

        return destFilePath;
    } catch (error) {
        console.log('Error while copy ever icons for seeder', error);
    }
}
