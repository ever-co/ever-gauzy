// NOTE: do NOT ever put here any secure settings! (e.g. Secret Keys)
// We are using dotenv (.env) for consistency with other Platform projects
// This is Angular app and all settings will be loaded into the client browser!

import { env } from './env';
import { writeFile, unlinkSync } from 'fs';
import { argv } from 'yargs';

const environment = argv.environment;
const isProd = environment === 'prod';

let envFileContent;

if (!env.GOOGLE_MAPS_API_KEY) {
	console.warn(
		'WARNING: No Google Maps API Key defined in the .env file. Google Maps may not be working!'
	);
}

if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY) {
	console.warn('WARNING: No Cloudinary API keys defined in the .env file.');
}

envFileContent = `// NOTE: Auto-generated file
// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses 'environment.ts', but if you do
// 'ng build --env=prod' then 'environment.prod.ts' will be used instead.
// The list of which env maps to which file can be found in '.angular-cli.json'.

import { Environment } from './model';
import { CloudinaryConfiguration } from '@cloudinary/angular-5.x';
import { ElectronService } from 'ngx-electron';

`;

if (!env.IS_DOCKER) {
	envFileContent += `

	let API_BASE_URL = '${env.API_BASE_URL}';
	let CLIENT_BASE_URL = '${env.CLIENT_BASE_URL}';

	let IS_ELECTRON = false;
	let IS_INTEGRATED_DESKTOP = false;

	// https://github.com/electron/electron/issues/2288#issuecomment-337858978
	const userAgent = navigator.userAgent.toLowerCase();
	if (userAgent.indexOf(' electron/') > -1) {
		try {
			const el: ElectronService = new ElectronService();
			const variableGlobal = el.remote.getGlobal('variableGlobal');
			API_BASE_URL = variableGlobal.API_BASE_URL;
			IS_ELECTRON = true;
			IS_INTEGRATED_DESKTOP = variableGlobal.IS_INTEGRATED_DESKTOP
		} catch(e) {
		}
	}

	export const environment: Environment = 
	{
		production:  ${isProd},

		API_BASE_URL: API_BASE_URL,
		CLIENT_BASE_URL: CLIENT_BASE_URL,

		COMPANY_NAME: 'Ever Co. LTD',
		COMPANY_SITE: 'Gauzy',
		COMPANY_LINK: 'https://ever.co/',
		COMPANY_SITE_LINK: 'https://gauzy.co',
		COMPANY_GITHUB_LINK: 'https://github.com/ever-co',
		COMPANY_FACEBOOK_LINK: 'https://www.facebook.com/gauzyplatform',
		COMPANY_TWITTER_LINK: 'https://twitter.com/gauzyplatform',
		COMPANY_LINKEDIN_LINK: 'https://www.linkedin.com/company/ever-co.',

		CLOUDINARY_CLOUD_NAME: '${env.CLOUDINARY_CLOUD_NAME}',
		CLOUDINARY_API_KEY: '${env.CLOUDINARY_API_KEY}',

		GOOGLE_AUTH_LINK: API_BASE_URL + '/api/auth/google',
		FACEBOOK_AUTH_LINK: API_BASE_URL + '/api/auth/facebook',
		LINKEDIN_AUTH_LINK: API_BASE_URL + '/api/auth/linkedin',
		GITHUB_AUTH_LINK: API_BASE_URL + '/api/auth/github',
		TWITTER_AUTH_LINK: API_BASE_URL + '/api/auth/twitter',
		MICROSOFT_AUTH_LINK: API_BASE_URL + '/api/auth/microsoft',
		AUTH0_AUTH_LINK: API_BASE_URL + '/api/auth/auth0',

		NO_INTERNET_LOGO: 'assets/images/logos/logo_Gauzy.svg',

		SENTRY_DSN: '${env.SENTRY_DSN}',

		HUBSTAFF_REDIRECT_URI: CLIENT_BASE_URL + '/pages/integrations/hubstaff',

		IS_ELECTRON: IS_ELECTRON,
		IS_INTEGRATED_DESKTOP: IS_INTEGRATED_DESKTOP,

		GOOGLE_MAPS_API_KEY: '${env.GOOGLE_MAPS_API_KEY}',
		GOOGLE_PLACE_AUTOCOMPLETE: ${env.GOOGLE_PLACE_AUTOCOMPLETE},

		DEFAULT_LATITUDE: ${env.DEFAULT_LATITUDE},
		DEFAULT_LONGITUDE: ${env.DEFAULT_LONGITUDE},
		DEFAULT_CURRENCY: '${env.DEFAULT_CURRENCY}',

		DEMO: ${env.DEMO},

		CHATWOOT_SDK_TOKEN: '${env.CHATWOOT_SDK_TOKEN}'
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
			const el: ElectronService = new ElectronService();
			const variableGlobal = el.remote.getGlobal('variableGlobal');
			API_BASE_URL = variableGlobal.API_BASE_URL;
			IS_ELECTRON = true;
			IS_INTEGRATED_DESKTOP = variableGlobal.IS_INTEGRATED_DESKTOP
		} catch(e) {
		}
	}

	export const environment: Environment = 
	{
		production:  ${isProd},

		API_BASE_URL: API_BASE_URL,
		CLIENT_BASE_URL: CLIENT_BASE_URL,

		COMPANY_NAME: 'Ever Co. LTD',
		COMPANY_SITE: 'Gauzy',
		COMPANY_LINK: 'https://ever.co/',
		COMPANY_SITE_LINK: 'https://gauzy.co',
		COMPANY_GITHUB_LINK: 'https://github.com/ever-co',
		COMPANY_FACEBOOK_LINK: 'https://www.facebook.com/gauzyplatform',
		COMPANY_TWITTER_LINK: 'https://twitter.com/gauzyplatform',
		COMPANY_LINKEDIN_LINK: 'https://www.linkedin.com/company/ever-co.',

		CLOUDINARY_CLOUD_NAME: 'DOCKER_CLOUDINARY_CLOUD_NAME',
		CLOUDINARY_API_KEY: 'DOCKER_CLOUDINARY_API_KEY',

		GOOGLE_AUTH_LINK: API_BASE_URL + '/api/auth/google',
		FACEBOOK_AUTH_LINK: API_BASE_URL + '/api/auth/facebook',
		LINKEDIN_AUTH_LINK: API_BASE_URL + '/api/auth/linkedin',
		GITHUB_AUTH_LINK: API_BASE_URL + '/api/auth/github',
		TWITTER_AUTH_LINK: API_BASE_URL + '/api/auth/twitter',
		MICROSOFT_AUTH_LINK: API_BASE_URL + '/api/auth/microsoft',
		AUTH0_AUTH_LINK: API_BASE_URL + '/api/auth/auth0',

		NO_INTERNET_LOGO: 'assets/images/logos/logo_Gauzy.svg',

		SENTRY_DSN: 'DOCKER_SENTRY_DSN',

		HUBSTAFF_REDIRECT_URI: CLIENT_BASE_URL + '/pages/integrations/hubstaff',

		IS_ELECTRON: IS_ELECTRON,
		IS_INTEGRATED_DESKTOP: IS_INTEGRATED_DESKTOP,

		GOOGLE_MAPS_API_KEY: 'DOCKER_GOOGLE_MAPS_API_KEY',

		// @ts-ignore
		GOOGLE_PLACE_AUTOCOMPLETE: 'DOCKER_GOOGLE_PLACE_AUTOCOMPLETE' == 'true',

		DEFAULT_LATITUDE: ${env.DEFAULT_LATITUDE},
		DEFAULT_LONGITUDE: ${env.DEFAULT_LONGITUDE},
		DEFAULT_CURRENCY: 'DOCKER_DEFAULT_CURRENCY',

		// @ts-ignore
		DEMO: 'DOCKER_DEMO' == 'true',

		CHATWOOT_SDK_TOKEN: '${env.CHATWOOT_SDK_TOKEN}'
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
	import 'zone.js/dist/zone-error';  // Included with Angular CLI.

	`;
}

// we always want first to remove old generated files (one of them is not needed for current build)
try {
	unlinkSync(`./apps/gauzy/src/environments/environment.ts`);
} catch {}
try {
	unlinkSync(`./apps/gauzy/src/environments/environment.prod.ts`);
} catch {}

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
	'',
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
