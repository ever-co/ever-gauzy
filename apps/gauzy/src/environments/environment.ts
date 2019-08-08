import { CloudinaryConfiguration } from '@cloudinary/angular-5.x';

// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
    production: false,

    COMPANY_NAME: 'Ever Co. LTD',
    COMPANY_SITE: 'Gauzy',
    COMPANY_LINK: 'https://ever.co/',
    COMPANY_SITE_LINK: 'https://gauzy.co',
    COMPANY_GITHUB_LINK: 'https://github.com/ever-co',
    COMPANY_FACEBOOK_LINK: 'https://www.facebook.com/gauzyplatform',
    COMPANY_TWITTER_LINK: 'https://twitter.com/gauzyplatform',
    COMPANY_LINKEDIN_LINK: 'https://www.linkedin.com/company/ever-co.',
    CLOUDINARY_CLOUD_NAME: 'dv6ezkfxg',
    CLOUDINARY_API_KEY: '256868982483961'
};

export const cloudinaryConfiguration: CloudinaryConfiguration = {
    cloud_name: environment.CLOUDINARY_CLOUD_NAME,
    api_key: environment.CLOUDINARY_API_KEY
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
