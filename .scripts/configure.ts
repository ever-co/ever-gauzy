// NOTE: do NOT ever put here any secure settings! (e.g. Secret Keys)
// We are using dotenv (.env) for consistency with other Platform projects
// This is Angular app and all settings will be loaded into the client browser!

import { env } from './env';
import { writeFile, unlinkSync } from 'fs';
import { argv } from 'yargs';

const environment = argv.environment;
const isProd = environment === 'prod';

const envFileContent = `// NOTE: Auto-generated file
// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses 'environment.ts', but if you do
// 'ng build --env=prod' then 'environment.prod.ts' will be used instead.
// The list of which env maps to which file can be found in '.angular-cli.json'.

import { Environment } from './model';
import { CloudinaryConfiguration } from '@cloudinary/angular-5.x';
import { ElectronService } from 'ngx-electron';

let API_BASE_URL = '${env.API_BASE_URL}';

// https://github.com/electron/electron/issues/2288#issuecomment-337858978
const userAgent = navigator.userAgent.toLowerCase();
if (userAgent.indexOf(' electron/') > -1) {
	try {
		const el: ElectronService = new ElectronService();
		const variableGlobal = el.remote.getGlobal('variableGlobal');
		API_BASE_URL = variableGlobal.API_BASE_URL;
	} catch(e) {
	}
}

export const environment: Environment = {
  production:  ${isProd},

  API_BASE_URL: API_BASE_URL,
  COMPANY_NAME: 'Ever Co. LTD',
  COMPANY_SITE: 'Gauzy',
  COMPANY_LINK: 'https://ever.co/',
  COMPANY_SITE_LINK: 'https://gauzy.co',
  COMPANY_GITHUB_LINK: 'https://github.com/ever-co',
  COMPANY_FACEBOOK_LINK: 'https://www.facebook.com/gauzyplatform',
  COMPANY_TWITTER_LINK: 'https://twitter.com/gauzyplatform',
  COMPANY_LINKEDIN_LINK: 'https://www.linkedin.com/company/ever-co.',
  CLOUDINARY_CLOUD_NAME: 'dv6ezkfxg',
  CLOUDINARY_API_KEY: '256868982483961',
  GOOGLE_AUTH_LINK: 'http://localhost:3000/api/auth/google',
  FACEBOOK_AUTH_LINK: 'http://localhost:3000/api/auth/facebook',
  LINKEDIN_AUTH_LINK: '#',
  NO_INTERNET_LOGO: 'assets/images/logos/logo_Gauzy.svg',
  SENTRY_DNS: 'https://19293d39eaa14d03aac4d3c156c4d30e@sentry.io/4397292',
  HUBSTAFF_REDIRECT_URI: 'http://localhost:4200/pages/integrations/hubstaff'
};

export const cloudinaryConfiguration: CloudinaryConfiguration = {
  cloud_name: environment.CLOUDINARY_CLOUD_NAME,
  api_key: environment.CLOUDINARY_API_KEY
};

/*
* For easier debugging in development mode, you can import the following file
* to ignore zone related error stack frames such as 'zone.run', 'zoneDelegate.invokeTask'.
*
* This import should be commented out in production mode because it will have a negative impact
* on performance if an error is thrown.
*/
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
`;

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

writeFile(`./apps/gauzy/src/environments/${envFileDestOther}`, '', function (
	err
) {
	if (err) {
		console.log(err);
	} else {
		console.log(
			`Generated Second Empty Angular environment file: ${envFileDestOther}`
		);
	}
});
