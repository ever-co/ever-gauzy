// NOTE: Auto-generated file
// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses 'environment.ts', but if you do
// 'ng build --env=prod' then 'environment.prod.ts' will be used instead.
// The list of which env maps to which file can be found in '.angular-cli.json'.

import { Environment } from './model';
import { CloudinaryConfiguration } from '@cloudinary/angular-5.x';

export const environment: Environment = {
  production: false,

  API_BASE_URL: 'http://localhost:3000',
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
  LINKEDIN_AUTH_LINK: '#'
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
