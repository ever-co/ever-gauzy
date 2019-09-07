import { CloudinaryConfiguration } from '@cloudinary/angular-5.x';

export const environment = {
  production: true,
  COMPANY_NAME: 'Ever Co. LTD',
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