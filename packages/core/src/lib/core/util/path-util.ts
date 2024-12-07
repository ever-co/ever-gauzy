import { resolve, join } from 'path';

/**
 * Resolves a file path based on the environment (production or development).
 *
 * @param {string} distPath - The path to use in the production (dist) environment.
 * @param {string} devPath - The path to use in the development (src) environment.
 * @returns {string} - The resolved file path based on the current environment.
 */
export function resolveEnvironmentPath(distPath: string, devPath: string): string {
    const basePath = __dirname.includes(join('dist')) ? distPath : devPath;
    return resolve(process.cwd(), basePath);
}

/**
 * Gets the API public path.
 *
 * @returns {string} - The resolved public path for the API.
 */
export function getApiPublicPath(): string {
    return resolveEnvironmentPath('apps/api/public', '../../apps/api/public');
}
