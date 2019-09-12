import { CloudinaryConfiguration } from '@cloudinary/angular-5.x';

export const environment = {
  production: true,

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
  FACEBOOK_AUTH_LINK: 'http://localhost:3000/api/auth/facebook',
  LINKEDIN_AUTH_LINK: '#'
};

export const cloudinaryConfiguration: CloudinaryConfiguration = {
  cloud_name: environment.CLOUDINARY_CLOUD_NAME,
  api_key: environment.CLOUDINARY_API_KEY
};
