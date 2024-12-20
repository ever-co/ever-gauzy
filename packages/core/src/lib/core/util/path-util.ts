import * as path from 'path';

/**
 * Resolves a file path based on the current environment (production or development).
 *
 * @param {string} distPath - The relative path for the production environment.
 * @param {string} devPath - The relative path for the development environment.
 * @returns {string} - The resolved absolute file path.
 */
export function resolveEnvironmentPath(distPath: string, devPath: string): string {
    const isProduction = __dirname.includes(path.join('dist'));
    const relativePath = isProduction ? distPath : devPath;
    return path.resolve(process.cwd(), relativePath);
}

/**
 * Gets the public directory path for the API.
 *
 * @returns {string} - The resolved absolute public directory path.
 */
export function getApiPublicPath(): string {
    return resolveEnvironmentPath('apps/api/public', 'apps/api/public');
}
