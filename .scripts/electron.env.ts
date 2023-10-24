// NOTE: do NOT ever put here any secure settings! (e.g. Secret Keys)
// We are using dotenv (.env) for consistency with other Platform projects
// This is Angular app and all settings will be loaded into the client browser!

import { writeFile, unlinkSync } from 'fs';
import { argv } from 'yargs';
import { env } from './env';

const environment = argv.environment;
const desktop = argv.desktop;
const isProd = environment === 'prod';

if (isProd) {
	const envFileContent = `
    export const environment = {
        production: true,
        AWHost: 'http://localhost:5600',
        API_DEFAULT_PORT: 3000,
        GAUZY_UI_DEFAULT_PORT: 5621,
        SCREENSHOTS_ENGINE_METHOD: 'ScreenshotDesktopLib', // ElectronDesktopCapturer || ScreenshotDesktopLib
        SENTRY_DSN: '${env.SENTRY_DSN}',
		SENTRY_TRACES_SAMPLE_RATE: '${env.SENTRY_TRACES_SAMPLE_RATE}',
		PLATFORM_LOGO_URL: '${env.PLATFORM_LOGO_URL}',
		PROJECT_REPO: '${env.PROJECT_REPO}',
		COMPANY_SITE_LINK: '${env.COMPANY_SITE_LINK}',
		${(desktop === 'desktop-timer') ? `
		DESKTOP_TIMER_APP_NAME: '${env.DESKTOP_TIMER_APP_NAME}',
		DESKTOP_TIMER_APP_DESCRIPTION: '${env.DESKTOP_TIMER_APP_DESCRIPTION}',
		DESKTOP_TIMER_APP_ID: '${env.DESKTOP_TIMER_APP_ID}',
		DESKTOP_TIMER_APP_REPO_NAME: '${env.DESKTOP_TIMER_APP_REPO_NAME}',
		DESKTOP_TIMER_APP_REPO_OWNER: '${env.DESKTOP_TIMER_APP_REPO_OWNER}',
		DESKTOP_TIMER_APP_WELCOME_TITLE: '${env.DESKTOP_TIMER_APP_WELCOME_TITLE}',
		DESKTOP_TIMER_APP_WELCOME_CONTENT: '${env.DESKTOP_TIMER_APP_WELCOME_CONTENT}',
		DESKTOP_TIMER_APP_I18N_FILES_URL: '${env.DESKTOP_TIMER_APP_I18N_FILES_URL}',
		`: ``}
		${(desktop === 'desktop') ? `
		DESKTOP_APP_NAME: '${env.DESKTOP_APP_NAME}',
		DESKTOP_APP_DESCRIPTION: '${env.DESKTOP_APP_DESCRIPTION}',
		DESKTOP_APP_ID: '${env.DESKTOP_APP_ID}',
		DESKTOP_APP_REPO_NAME: '${env.DESKTOP_APP_REPO_NAME}',
		DESKTOP_APP_REPO_OWNER: '${env.DESKTOP_APP_REPO_OWNER}',
		DESKTOP_APP_WELCOME_TITLE: '${env.DESKTOP_APP_WELCOME_TITLE}',
		DESKTOP_APP_WELCOME_CONTENT: '${env.DESKTOP_APP_WELCOME_CONTENT}',
		DESKTOP_APP_I18N_FILES_URL: '${env.DESKTOP_APP_I18N_FILES_URL}',
		DESKTOP_TIMER_APP_NAME: '${env.DESKTOP_APP_NAME}',
		DESKTOP_TIMER_APP_DESCRIPTION: '${env.DESKTOP_APP_DESCRIPTION}',
		` : ``}
		${(desktop === 'server') ? `
		DESKTOP_SERVER_APP_NAME: '${env.DESKTOP_SERVER_APP_NAME}',
		DESKTOP_SERVER_APP_DESCRIPTION: '${env.DESKTOP_SERVER_APP_DESCRIPTION}',
		DESKTOP_SERVER_APP_ID: '${env.DESKTOP_SERVER_APP_ID}',
		DESKTOP_SERVER_APP_REPO_NAME: '${env.DESKTOP_SERVER_APP_REPO_NAME}',
		DESKTOP_SERVER_APP_REPO_OWNER: '${env.DESKTOP_SERVER_APP_REPO_OWNER}',
		DESKTOP_SERVER_APP_WELCOME_TITLE: '${env.DESKTOP_SERVER_APP_WELCOME_TITLE}',
		DESKTOP_SERVER_APP_WELCOME_CONTENT: '${env.DESKTOP_SERVER_APP_WELCOME_CONTENT}',
		DESKTOP_SERVER_APP_I18N_FILES_URL: '${env.DESKTOP_SERVER_APP_I18N_FILES_URL}'
		` : ``}
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
	} else if (desktop === 'desktop-timer') {
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
	} else if (desktop === 'server') {
		writeFile(
			`./apps/server/src/environments/${envFileDestProd}`,
			envFileContent,
			function (err) {
				if (err) {
					console.log(err);
				} else {
					console.log(
						`Generated server production environment file: ${envFileDestProd}`
					);
				}
			}
		);
		writeFile(
			`./apps/server/src/environments/${envFileDest}`,
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
	} else throw `Incorrect value of desktop parameter ${desktop}`;
}

// we always want first to remove old generated files (one of them is not needed for current build)
