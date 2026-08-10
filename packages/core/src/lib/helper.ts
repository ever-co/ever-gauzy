import { ServeStaticModuleOptions } from '@nestjs/serve-static';
import * as path from 'path';
import * as chalk from 'chalk';
import { ConfigService, environment } from '@gauzy/config';
import { getApiPublicPath } from './core/util/path-util';

/**
 * Resolves the path for serving static files based on the environment and configuration.
 *
 * This function determines the root directory for serving static files depending on whether
 * the application is running in an Electron environment or a non-Electron (e.g., Node.js) environment.
 * It uses the configuration service to retrieve the asset options for custom public paths,
 * falling back to a default directory if no custom path is specified.
 *
 * @param config - An instance of `ConfigService` used to access application configurations.
 * @returns A promise resolving to an array of `ServeStaticModuleOptions` containing
 * the root path and serve root for serving static assets.
 */
export async function resolveServeStaticPath(config: ConfigService): Promise<ServeStaticModuleOptions[]> {
	// Default public directory for assets
	const publicDir = getApiPublicPath();
	console.log(chalk.green(`✔ Server Static Config -> publicDir: ${publicDir}`));

	const assetPublicPath = environment.isElectron
		? path.resolve(environment.gauzyUserPath, 'public') // Electron-specific path
		: config.assetOptions.assetPublicPath || publicDir;

	console.log(chalk.green(`✔ Server Static Config -> rootPath: ${assetPublicPath}`));

	return [
		{
			rootPath: assetPublicPath,
			serveRoot: '/public/', // Root URL from which the static files are served
			serveStaticOptions: {
				setHeaders: (res: any) => {
					// Everything under `/public/` is user-uploaded and served unauthenticated, with a
					// Content-Type derived from the on-disk extension. These two headers neutralise the
					// stored-XSS class (GHSA-p334-cm7f-php5) for every asset, independently of the
					// per-endpoint upload filters:
					//   - nosniff stops a mistyped file being re-interpreted as active content;
					//   - the sandbox CSP (no `allow-scripts`) stops script running if such a file is
					//     opened as a top-level document, which is how an SVG payload executes.
					// `Content-Disposition: attachment` is deliberately NOT set — it would stop the app
					// displaying legitimate avatars, logos and screenshots inline.
					res.setHeader('X-Content-Type-Options', 'nosniff');
					res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
				}
			}
		}
	] as ServeStaticModuleOptions[];
}
