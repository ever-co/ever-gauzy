export interface Environment {
	production: boolean;

	API_BASE_URL: string;
	COMPANY_NAME: string;
	COMPANY_SITE: string;
	COMPANY_LINK: string;
	COMPANY_SITE_LINK: string;
	COMPANY_GITHUB_LINK: string;
	COMPANY_FACEBOOK_LINK: string;
	COMPANY_TWITTER_LINK: string;
	COMPANY_LINKEDIN_LINK: string;
	CLOUDINARY_CLOUD_NAME: string;
	CLOUDINARY_API_KEY: string;
	GOOGLE_AUTH_LINK: string;
	FACEBOOK_AUTH_LINK: string;
	LINKEDIN_AUTH_LINK: string;
	NO_INTERNET_LOGO: string;
	SENTRY_DNS?: string;
	HUBSTAFF_REDIRECT_URI?: string;
}
