// NOTE: do NOT ever put here any secure settings! (e.g. Secret Keys)
// We are using dotenv (.env) for consistency with other Platform projects
// This is Angular app and all settings will be loaded into the client browser!

import { env } from './env';
import { writeFile, unlinkSync } from 'fs';
import { argv } from 'yargs';

const environment = argv.environment;
const isProd = environment === 'prod';

let envFileContent = `// NOTE: Auto-generated file
// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses 'environment.ts', but if you do
// 'ng build --env=prod' then 'environment.prod.ts' will be used instead.
// The list of which env maps to which file can be found in '.angular-cli.json'.
declare const window:any;

import { Environment } from './model';
import { CloudinaryConfiguration } from '@cloudinary/angular-5.x';

`;

if (!env.IS_DOCKER) {
	if (!env.GOOGLE_MAPS_API_KEY) {
		console.warn(
			'WARNING: No Google Maps API Key defined in the .env file. Google Maps may not be working!'
		);
	}

	if (!env.SENTRY_DSN) {
		console.warn(
			'WARNING: No Sentry DSN defined in the .env file. Sentry logging may not be working!'
		);
	}

	if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY) {
		console.warn(
			'WARNING: No Cloudinary API keys defined in the .env file.'
		);
	}

	if (!env.JITSU_BROWSER_URL || !env.JITSU_BROWSER_WRITE_KEY) {
		console.warn(
			'WARNING: No Jitsu keys defined for browser in the .env file. Jitsu analytics may not be working!'
		);
	}

	envFileContent += `

	let API_BASE_URL = '${env.API_BASE_URL}';
	let CLIENT_BASE_URL = '${env.CLIENT_BASE_URL}';

	let IS_ELECTRON = false;
	let IS_INTEGRATED_DESKTOP = false;

	// https://github.com/electron/electron/issues/2288#issuecomment-337858978
	const userAgent = navigator.userAgent.toLowerCase();
	if (userAgent.indexOf(' electron/') > -1) {
		try {
			const remote = window.require('@electron/remote');
			const variableGlobal = remote.getGlobal('variableGlobal');
			API_BASE_URL = variableGlobal.API_BASE_URL;
			IS_ELECTRON = true;
			IS_INTEGRATED_DESKTOP = variableGlobal.IS_INTEGRATED_DESKTOP
		} catch(e) {
			console.log(e);
		}
	}

	try {
		if (window._env && window._env.api) {
			API_BASE_URL= window._env.api;
		}

		if (window._env && window._env.api) {
			CLIENT_BASE_URL = window.location.origin;
		}
	} catch(e) {}

	export const environment: Environment =
	{
		production:  ${isProd},

		API_BASE_URL: API_BASE_URL,
		CLIENT_BASE_URL: CLIENT_BASE_URL,

		PLATFORM_WEBSITE_URL: '${env.PLATFORM_WEBSITE_URL}',
		PLATFORM_WEBSITE_DOWNLOAD_URL: '${env.PLATFORM_WEBSITE_DOWNLOAD_URL}',
		DESKTOP_APP_DOWNLOAD_LINK_APPLE: '${env.DESKTOP_APP_DOWNLOAD_LINK_APPLE}',
		DESKTOP_APP_DOWNLOAD_LINK_WINDOWS: '${env.DESKTOP_APP_DOWNLOAD_LINK_WINDOWS}',
		DESKTOP_APP_DOWNLOAD_LINK_LINUX: '${env.DESKTOP_APP_DOWNLOAD_LINK_LINUX}',
		MOBILE_APP_DOWNLOAD_LINK: '${env.MOBILE_APP_DOWNLOAD_LINK}',
		EXTENSION_DOWNLOAD_LINK: '${env.EXTENSION_DOWNLOAD_LINK}',

		COMPANY_NAME: '${env.COMPANY_NAME}',
		COMPANY_SITE: '${env.COMPANY_SITE}',
		COMPANY_LINK: '${env.COMPANY_LINK}',
		COMPANY_SITE_LINK: '${env.COMPANY_SITE_LINK}',
		COMPANY_GITHUB_LINK: '${env.COMPANY_GITHUB_LINK}',
		COMPANY_GITLAB_LINK: '${env.COMPANY_GITLAB_LINK}',
		COMPANY_FACEBOOK_LINK: '${env.COMPANY_FACEBOOK_LINK}',
		COMPANY_TWITTER_LINK: '${env.COMPANY_TWITTER_LINK}',
		COMPANY_LINKEDIN_LINK: '${env.COMPANY_LINKEDIN_LINK}',

		CLOUDINARY_CLOUD_NAME: '${env.CLOUDINARY_CLOUD_NAME}',
		CLOUDINARY_API_KEY: '${env.CLOUDINARY_API_KEY}',

		GOOGLE_AUTH_LINK: API_BASE_URL + '/api/auth/google',
		FACEBOOK_AUTH_LINK: API_BASE_URL + '/api/auth/facebook',
		LINKEDIN_AUTH_LINK: API_BASE_URL + '/api/auth/linkedin',
		GITHUB_AUTH_LINK: API_BASE_URL + '/api/auth/github',
		TWITTER_AUTH_LINK: API_BASE_URL + '/api/auth/twitter',
		MICROSOFT_AUTH_LINK: API_BASE_URL + '/api/auth/microsoft',
		AUTH0_AUTH_LINK: API_BASE_URL + '/api/auth/auth0',

		NO_INTERNET_LOGO: '${env.NO_INTERNET_LOGO}',

		SENTRY_DSN: '${env.SENTRY_DSN}',
		SENTRY_TRACES_SAMPLE_RATE: '${env.SENTRY_TRACES_SAMPLE_RATE}',

		HUBSTAFF_REDIRECT_URL: '${env.HUBSTAFF_REDIRECT_URL}',

		IS_ELECTRON: IS_ELECTRON,
		IS_INTEGRATED_DESKTOP: IS_INTEGRATED_DESKTOP,

		GOOGLE_MAPS_API_KEY: '${env.GOOGLE_MAPS_API_KEY}',
		GOOGLE_PLACE_AUTOCOMPLETE: ${env.GOOGLE_PLACE_AUTOCOMPLETE},

		DEFAULT_LATITUDE: ${env.DEFAULT_LATITUDE},
		DEFAULT_LONGITUDE: ${env.DEFAULT_LONGITUDE},
		DEFAULT_CURRENCY: '${env.DEFAULT_CURRENCY}',
		DEFAULT_COUNTRY: '${env.DEFAULT_COUNTRY}',

		DEMO: ${env.DEMO},

		DEMO_SUPER_ADMIN_EMAIL: '${env.DEMO_SUPER_ADMIN_EMAIL}',
		DEMO_SUPER_ADMIN_PASSWORD: '${env.DEMO_SUPER_ADMIN_PASSWORD}',

		DEMO_ADMIN_EMAIL: '${env.DEMO_ADMIN_EMAIL}',
		DEMO_ADMIN_PASSWORD: '${env.DEMO_ADMIN_PASSWORD}',

		DEMO_EMPLOYEE_EMAIL: '${env.DEMO_EMPLOYEE_EMAIL}',
		DEMO_EMPLOYEE_PASSWORD: '${env.DEMO_EMPLOYEE_PASSWORD}',

		CHATWOOT_SDK_TOKEN: '${env.CHATWOOT_SDK_TOKEN}',
		CHAT_MESSAGE_GOOGLE_MAP: '${env.CHAT_MESSAGE_GOOGLE_MAP}',
		GAUZY_CLOUD_APP: '${env.GAUZY_CLOUD_APP}',

		FILE_PROVIDER: '${env.FILE_PROVIDER}',

		JITSU_BROWSER_URL: '${env.JITSU_BROWSER_URL}',
		JITSU_BROWSER_WRITE_KEY: '${env.JITSU_BROWSER_WRITE_KEY}',

		GAUZY_GITHUB_APP_NAME: '${env.GAUZY_GITHUB_APP_NAME}',
		GAUZY_GITHUB_CLIENT_ID: '${env.GAUZY_GITHUB_CLIENT_ID}',
		GAUZY_GITHUB_REDIRECT_URL: '${env.GAUZY_GITHUB_REDIRECT_URL}',
		GAUZY_GITHUB_POST_INSTALL_URL: '${env.GAUZY_GITHUB_POST_INSTALL_URL}',

		PLATFORM_LOGO: '${env.PLATFORM_LOGO}',
		GAUZY_DESKTOP_LOGO_512X512: '${env.GAUZY_DESKTOP_LOGO_512X512}',
		PLATFORM_PRIVACY_URL: '${env.PLATFORM_PRIVACY_URL}',
		PLATFORM_TOS_URL: '${env.PLATFORM_TOS_URL}',
		PROJECT_REPO: '${env.PROJECT_REPO}',
		DESKTOP_TIMER_APP_NAME: '${env.DESKTOP_TIMER_APP_NAME}',
		DESKTOP_TIMER_APP_DESCRIPTION: '${env.DESKTOP_TIMER_APP_DESCRIPTION}',
		DESKTOP_TIMER_APP_ID: '${env.DESKTOP_TIMER_APP_ID}',
		DESKTOP_TIMER_APP_REPO_NAME: '${env.DESKTOP_TIMER_APP_REPO_NAME}',
		DESKTOP_TIMER_APP_REPO_OWNER: '${env.DESKTOP_TIMER_APP_REPO_OWNER}',
		DESKTOP_TIMER_APP_WELCOME_TITLE: '${env.DESKTOP_TIMER_APP_WELCOME_TITLE}',
		DESKTOP_TIMER_APP_WELCOME_CONTENT: '${env.DESKTOP_TIMER_APP_WELCOME_CONTENT}',
		DESKTOP_TIMER_APP_I18N_FILES_URL: '${env.DESKTOP_TIMER_APP_I18N_FILES_URL}',

		DESKTOP_APP_NAME: '${env.DESKTOP_APP_NAME}',
		DESKTOP_APP_DESCRIPTION: '${env.DESKTOP_APP_DESCRIPTION}',
		DESKTOP_APP_ID: '${env.DESKTOP_APP_ID}',
		DESKTOP_APP_REPO_NAME: '${env.DESKTOP_APP_REPO_NAME}',
		DESKTOP_APP_REPO_OWNER: '${env.DESKTOP_APP_REPO_OWNER}',
		DESKTOP_APP_WELCOME_TITLE: '${env.DESKTOP_APP_WELCOME_TITLE}',
		DESKTOP_APP_WELCOME_CONTENT: '${env.DESKTOP_APP_WELCOME_CONTENT}',
		DESKTOP_APP_I18N_FILES_URL: '${env.DESKTOP_APP_I18N_FILES_URL}',

		DESKTOP_SERVER_APP_NAME: '${env.DESKTOP_SERVER_APP_NAME}',
		DESKTOP_SERVER_APP_DESCRIPTION: '${env.DESKTOP_SERVER_APP_DESCRIPTION}',
		DESKTOP_SERVER_APP_ID: '${env.DESKTOP_SERVER_APP_ID}',
		DESKTOP_SERVER_APP_REPO_NAME: '${env.DESKTOP_SERVER_APP_REPO_NAME}',
		DESKTOP_SERVER_APP_REPO_OWNER: '${env.DESKTOP_SERVER_APP_REPO_OWNER}',
		DESKTOP_SERVER_APP_WELCOME_TITLE: '${env.DESKTOP_SERVER_APP_WELCOME_TITLE}',
		DESKTOP_SERVER_APP_WELCOME_CONTENT: '${env.DESKTOP_SERVER_APP_WELCOME_CONTENT}',
		DESKTOP_SERVER_APP_I18N_FILES_URL: '${env.DESKTOP_SERVER_APP_I18N_FILES_URL}'
	};
	`;
} else {
	envFileContent += `

	let API_BASE_URL = 'DOCKER_API_BASE_URL';
	let CLIENT_BASE_URL = 'DOCKER_CLIENT_BASE_URL';

	let IS_ELECTRON = false;
	let IS_INTEGRATED_DESKTOP = false;

	// https://github.com/electron/electron/issues/2288#issuecomment-337858978
	const userAgent = navigator.userAgent.toLowerCase();
	if (userAgent.indexOf(' electron/') > -1) {
		try {
			const remote = window.require('@electron/remote');
			const variableGlobal = remote.getGlobal('variableGlobal');
			API_BASE_URL = variableGlobal.API_BASE_URL;
			IS_ELECTRON = true;
			IS_INTEGRATED_DESKTOP = variableGlobal.IS_INTEGRATED_DESKTOP
		} catch(e) {
			console.log(e);
		}
	}

	export const environment: Environment =
	{
		production:  ${isProd},

		API_BASE_URL: API_BASE_URL,
		CLIENT_BASE_URL: CLIENT_BASE_URL,

		PLATFORM_WEBSITE_URL: '${env.PLATFORM_WEBSITE_URL}',
		PLATFORM_WEBSITE_DOWNLOAD_URL: '${env.PLATFORM_WEBSITE_DOWNLOAD_URL}',
		DESKTOP_APP_DOWNLOAD_LINK_APPLE: '${env.DESKTOP_APP_DOWNLOAD_LINK_APPLE}',
		DESKTOP_APP_DOWNLOAD_LINK_WINDOWS: '${env.DESKTOP_APP_DOWNLOAD_LINK_WINDOWS}',
		DESKTOP_APP_DOWNLOAD_LINK_LINUX: '${env.DESKTOP_APP_DOWNLOAD_LINK_LINUX}',
		MOBILE_APP_DOWNLOAD_LINK: '${env.MOBILE_APP_DOWNLOAD_LINK}',
		EXTENSION_DOWNLOAD_LINK: '${env.EXTENSION_DOWNLOAD_LINK}',

		COMPANY_NAME: '${env.COMPANY_NAME}',
		COMPANY_SITE: '${env.COMPANY_SITE}',
		COMPANY_LINK: '${env.COMPANY_LINK}',
		COMPANY_SITE_LINK: '${env.COMPANY_SITE_LINK}',
		COMPANY_GITHUB_LINK: '${env.COMPANY_GITHUB_LINK}',
		COMPANY_GITLAB_LINK: '${env.COMPANY_GITLAB_LINK}',
		COMPANY_FACEBOOK_LINK: '${env.COMPANY_FACEBOOK_LINK}',
		COMPANY_TWITTER_LINK: '${env.COMPANY_TWITTER_LINK}',
		COMPANY_LINKEDIN_LINK: '${env.COMPANY_LINKEDIN_LINK}',

		CLOUDINARY_CLOUD_NAME: 'DOCKER_CLOUDINARY_CLOUD_NAME',
		CLOUDINARY_API_KEY: 'DOCKER_CLOUDINARY_API_KEY',

		GOOGLE_AUTH_LINK: API_BASE_URL + '/api/auth/google',
		FACEBOOK_AUTH_LINK: API_BASE_URL + '/api/auth/facebook',
		LINKEDIN_AUTH_LINK: API_BASE_URL + '/api/auth/linkedin',
		GITHUB_AUTH_LINK: API_BASE_URL + '/api/auth/github',
		TWITTER_AUTH_LINK: API_BASE_URL + '/api/auth/twitter',
		MICROSOFT_AUTH_LINK: API_BASE_URL + '/api/auth/microsoft',
		AUTH0_AUTH_LINK: API_BASE_URL + '/api/auth/auth0',

		NO_INTERNET_LOGO: '${env.NO_INTERNET_LOGO}',

		SENTRY_DSN: 'DOCKER_SENTRY_DSN',
		SENTRY_TRACES_SAMPLE_RATE: 'DOCKER_SENTRY_TRACES_SAMPLE_RATE',

		HUBSTAFF_REDIRECT_URL: 'DOCKER_HUBSTAFF_REDIRECT_URL',

		IS_ELECTRON: IS_ELECTRON,
		IS_INTEGRATED_DESKTOP: IS_INTEGRATED_DESKTOP,

		GOOGLE_MAPS_API_KEY: 'DOCKER_GOOGLE_MAPS_API_KEY',

		// @ts-ignore
		GOOGLE_PLACE_AUTOCOMPLETE: 'DOCKER_GOOGLE_PLACE_AUTOCOMPLETE' == 'true',

		DEFAULT_LATITUDE: ${env.DEFAULT_LATITUDE},
		DEFAULT_LONGITUDE: ${env.DEFAULT_LONGITUDE},
		DEFAULT_CURRENCY: 'DOCKER_DEFAULT_CURRENCY',
		DEFAULT_COUNTRY: 'DOCKER_DEFAULT_COUNTRY',

		// @ts-ignore
		DEMO: 'DOCKER_DEMO' == 'true',

		DEMO_SUPER_ADMIN_EMAIL: '${env.DEMO_SUPER_ADMIN_EMAIL}',
		DEMO_SUPER_ADMIN_PASSWORD: '${env.DEMO_SUPER_ADMIN_PASSWORD}',

		DEMO_ADMIN_EMAIL: '${env.DEMO_ADMIN_EMAIL}',
		DEMO_ADMIN_PASSWORD: '${env.DEMO_ADMIN_PASSWORD}',

		DEMO_EMPLOYEE_EMAIL: '${env.DEMO_EMPLOYEE_EMAIL}',
		DEMO_EMPLOYEE_PASSWORD: '${env.DEMO_EMPLOYEE_PASSWORD}',

		CHATWOOT_SDK_TOKEN: 'DOCKER_CHATWOOT_SDK_TOKEN',
		CHAT_MESSAGE_GOOGLE_MAP: 'DOCKER_CHAT_MESSAGE_GOOGLE_MAP',
		GAUZY_CLOUD_APP: 'DOCKER_GAUZY_CLOUD_APP',

		FILE_PROVIDER: '${env.FILE_PROVIDER}',

		JITSU_BROWSER_URL: 'DOCKER_JITSU_BROWSER_URL',
		JITSU_BROWSER_WRITE_KEY: 'DOCKER_JITSU_BROWSER_WRITE_KEY',

		GAUZY_GITHUB_APP_NAME: 'DOCKER_GAUZY_GITHUB_APP_NAME',
		GAUZY_GITHUB_CLIENT_ID: 'DOCKER_GAUZY_GITHUB_CLIENT_ID',
		GAUZY_GITHUB_REDIRECT_URL: 'DOCKER_GAUZY_GITHUB_REDIRECT_URL',
		GAUZY_GITHUB_POST_INSTALL_URL: 'DOCKER_GAUZY_GITHUB_POST_INSTALL_URL',

		PLATFORM_LOGO: '${env.PLATFORM_LOGO}',
		GAUZY_DESKTOP_LOGO_512X512: '${env.GAUZY_DESKTOP_LOGO_512X512}',
		PLATFORM_PRIVACY_URL: '${env.PLATFORM_PRIVACY_URL}',
		PLATFORM_TOS_URL: '${env.PLATFORM_TOS_URL}',

		PROJECT_REPO: '${env.PROJECT_REPO}',
		DESKTOP_TIMER_APP_NAME: '${env.DESKTOP_TIMER_APP_NAME}',
		DESKTOP_TIMER_APP_DESCRIPTION: '${env.DESKTOP_TIMER_APP_DESCRIPTION}',
		DESKTOP_TIMER_APP_ID: '${env.DESKTOP_TIMER_APP_ID}',
		DESKTOP_TIMER_APP_REPO_NAME: '${env.DESKTOP_TIMER_APP_REPO_NAME}',
		DESKTOP_TIMER_APP_REPO_OWNER: '${env.DESKTOP_TIMER_APP_REPO_OWNER}',
		DESKTOP_TIMER_APP_WELCOME_TITLE: '${env.DESKTOP_TIMER_APP_WELCOME_TITLE}',
		DESKTOP_TIMER_APP_WELCOME_CONTENT: '${env.DESKTOP_TIMER_APP_WELCOME_CONTENT}',
		DESKTOP_TIMER_APP_I18N_FILES_URL: '${env.DESKTOP_TIMER_APP_I18N_FILES_URL}',

		DESKTOP_APP_NAME: '${env.DESKTOP_APP_NAME}',
		DESKTOP_APP_DESCRIPTION: '${env.DESKTOP_APP_DESCRIPTION}',
		DESKTOP_APP_ID: '${env.DESKTOP_APP_ID}',
		DESKTOP_APP_REPO_NAME: '${env.DESKTOP_APP_REPO_NAME}',
		DESKTOP_APP_REPO_OWNER: '${env.DESKTOP_APP_REPO_OWNER}',
		DESKTOP_APP_WELCOME_TITLE: '${env.DESKTOP_APP_WELCOME_TITLE}',
		DESKTOP_APP_WELCOME_CONTENT: '${env.DESKTOP_APP_WELCOME_CONTENT}',
		DESKTOP_APP_I18N_FILES_URL: '${env.DESKTOP_APP_I18N_FILES_URL}',

		DESKTOP_SERVER_APP_NAME: '${env.DESKTOP_SERVER_APP_NAME}',
		DESKTOP_SERVER_APP_DESCRIPTION: '${env.DESKTOP_SERVER_APP_DESCRIPTION}',
		DESKTOP_SERVER_APP_ID: '${env.DESKTOP_SERVER_APP_ID}',
		DESKTOP_SERVER_APP_REPO_NAME: '${env.DESKTOP_SERVER_APP_REPO_NAME}',
		DESKTOP_SERVER_APP_REPO_OWNER: '${env.DESKTOP_SERVER_APP_REPO_OWNER}',
		DESKTOP_SERVER_APP_WELCOME_TITLE: '${env.DESKTOP_SERVER_APP_WELCOME_TITLE}',
		DESKTOP_SERVER_APP_WELCOME_CONTENT: '${env.DESKTOP_SERVER_APP_WELCOME_CONTENT}',
		DESKTOP_SERVER_APP_I18N_FILES_URL: '${env.DESKTOP_SERVER_APP_I18N_FILES_URL}'
	};
`;
}

envFileContent += `

	export const cloudinaryConfiguration: CloudinaryConfiguration = {
		cloud_name: environment.CLOUDINARY_CLOUD_NAME,
		api_key: environment.CLOUDINARY_API_KEY
	};

`;

if (!isProd) {
	envFileContent += `

	// For easier debugging in development mode, you can import the following file
	// to ignore zone related error stack frames such as 'zone.run', 'zoneDelegate.invokeTask'.
	import 'zone.js';  // Included with Angular CLI.

	`;
}

// we always want first to remove old generated files (one of them is not needed for current build)
try {
	unlinkSync(`./apps/gauzy/src/environments/environment.ts`);
} catch { }
try {
	unlinkSync(`./apps/gauzy/src/environments/environment.prod.ts`);
} catch { }

const envFileDest: string = isProd ? 'environment.prod.ts' : 'environment.ts';
const envFileDestOther: string = !isProd
	? 'environment.prod.ts'
	: 'environment.ts';

writeFile(
	`./apps/gauzy/src/environments/${envFileDest}`,
	envFileContent,
	function (err) {
		if (err) {
			console.log(err);
		} else {
			console.log(`Generated Angular environment file: ${envFileDest}`);
		}
	}
);

writeFile(
	`./apps/gauzy/src/environments/${envFileDestOther}`,
	`export const environment = { production: ${!isProd} }`,
	function (err) {
		if (err) {
			console.log(err);
		} else {
			console.log(
				`Generated Second Empty Angular environment file: ${envFileDestOther}`
			);
		}
	}
);
