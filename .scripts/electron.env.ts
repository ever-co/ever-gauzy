// NOTE: do NOT ever put here any secure settings! (e.g. Secret Keys)
// We are using dotenv (.env) for consistency with other Platform projects
// This is Angular app and all settings will be loaded into the client browser!

import { writeFile, unlinkSync } from 'fs';
import { argv } from 'yargs';

const environment = argv.environment;
const desktop = argv.desktop;
const isProd = environment === 'prod';

if (isProd) {
	const envFileContent = `
    export const environment = {
        production: true,
        AWHost: 'http://localhost:5600',
        API_DEFAULT_PORT: 5620,
        GAUZY_UI_DEFAULT_PORT: 5621,
        SCREENSHOTS_ENGINE_METHOD: 'ScreenshotDesktopLib', // ElectronDesktopCapturer || ScreenshotDesktopLib
        SENTRY_DSN: '${process.env.SENTRY_DSN}'
    }
    `;
	try {
		if (desktop === 'desktop') {
			unlinkSync(`./apps/desktop/src/environments/environment.prod.ts`);
			unlinkSync(`./apps/desktop/src/environments/environment.ts`);
		} else {
			unlinkSync(
				`./apps/desktop-timer/src/environments/environment.prod.ts`
			);
			unlinkSync(`./apps/desktop-timer/src/environments/environment.ts`);
		}
	} catch {}

	const envFileDestProd: string = 'environment.prod.ts';
	const envFileDest: string = 'environment.ts';

	if (desktop === 'desktop') {
		writeFile(
			`./apps/desktop/src/environments/${envFileDestProd}`,
			envFileContent,
			function (err) {
				if (err) {
					console.log(err);
				} else {
					console.log(
						`Generated desktop production environment file: ${envFileDestProd}`
					);
				}
			}
		);
		writeFile(
			`./apps/desktop/src/environments/${envFileDest}`,
			envFileContent,
			function (err) {
				if (err) {
					console.log(err);
				} else {
					console.log(
						`Generated desktop environment file: ${envFileDest}`
					);
				}
			}
		);
	} else {
		writeFile(
			`./apps/desktop-timer/src/environments/${envFileDestProd}`,
			envFileContent,
			function (err) {
				if (err) {
					console.log(err);
				} else {
					console.log(
						`Generated desktop production environment file: ${envFileDestProd}`
					);
				}
			}
		);
		writeFile(
			`./apps/desktop-timer/src/environments/${envFileDest}`,
			envFileContent,
			function (err) {
				if (err) {
					console.log(err);
				} else {
					console.log(
						`Generated desktop environment file: ${envFileDest}`
					);
				}
			}
		);
	}
}

// we always want first to remove old generated files (one of them is not needed for current build)
