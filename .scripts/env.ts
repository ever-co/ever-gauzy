// NOTE: do NOT ever put here any secure settings! (e.g. Secret Keys)
// We are using dotenv (.env) for consistency with other Platform projects
// This is Angular app and all settings will be loaded into the client browser!

import { cleanEnv, str, bool, num } from 'envalid';

export type Env = Readonly<{
	production: boolean;

	// Set to true if build / runs in Docker
	IS_DOCKER: boolean;

	// Base URL of Gauzy UI website
	CLIENT_BASE_URL: string;

	// Base API URL
	API_BASE_URL: string;

	// Platform website
	PLATFORM_WEBSITE_URL: string;

	// Platform website Download URLS
	PLATFORM_WEBSITE_DOWNLOAD_URL: string;
	DESKTOP_APP_DOWNLOAD_LINK_APPLE: string;
	DESKTOP_APP_DOWNLOAD_LINK_WINDOWS: string;
	DESKTOP_APP_DOWNLOAD_LINK_LINUX: string;
	MOBILE_APP_DOWNLOAD_LINK: string;
	EXTENSION_DOWNLOAD_LINK: string;

	SENTRY_DSN: string;
	SENTRY_TRACES_SAMPLE_RATE: string;

	CLOUDINARY_CLOUD_NAME: string;
	CLOUDINARY_API_KEY: string;

	GOOGLE_MAPS_API_KEY: string;
	GOOGLE_PLACE_AUTOCOMPLETE: boolean;

	HUBSTAFF_REDIRECT_URL: string;

	DEFAULT_LATITUDE: number;
	DEFAULT_LONGITUDE: number;
	DEFAULT_CURRENCY: string;
	DEFAULT_COUNTRY?: string;

	DEMO: boolean;

	// Default Super Admin Credentials
	DEMO_SUPER_ADMIN_EMAIL?: string;
	DEMO_SUPER_ADMIN_PASSWORD?: string;

	// Default Admin Credentials
	DEMO_ADMIN_EMAIL?: string;
	DEMO_ADMIN_PASSWORD?: string;

	// Default Employee Credentials
	DEMO_EMPLOYEE_EMAIL?: string;
	DEMO_EMPLOYEE_PASSWORD?: string;

	CHATWOOT_SDK_TOKEN: string;

	//nebular chat map API key
	CHAT_MESSAGE_GOOGLE_MAP: string;

	GAUZY_CLOUD_APP: string;

	FILE_PROVIDER: string;

	// Jitsu Analytics
	JITSU_BROWSER_HOST: string;
	JITSU_BROWSER_WRITE_KEY: string;

	GAUZY_GITHUB_APP_NAME: string;
	GAUZY_GITHUB_APP_ID: string;
	GAUZY_GITHUB_CLIENT_ID: string;
	GAUZY_GITHUB_REDIRECT_URL: string;
}>;

export const env: Env = cleanEnv(
	process.env,
	{
		production: bool({ default: false }),

		IS_DOCKER: bool({ default: false }),

		CLIENT_BASE_URL: str({ default: 'http://localhost:4200' }),

		API_BASE_URL: str({ default: 'http://localhost:3000' }),

		PLATFORM_WEBSITE_URL: str({ default: 'https://gauzy.co' }),
		PLATFORM_WEBSITE_DOWNLOAD_URL: str({
			default: 'https://gauzy.co/downloads',
		}),
		DESKTOP_APP_DOWNLOAD_LINK_APPLE: str({
			default: 'https://gauzy.co/downloads#desktop/apple',
		}),
		DESKTOP_APP_DOWNLOAD_LINK_WINDOWS: str({
			default: 'https://gauzy.co/downloads#desktop/windows',
		}),
		DESKTOP_APP_DOWNLOAD_LINK_LINUX: str({
			default: 'https://gauzy.co/downloads#desktop/linux',
		}),
		MOBILE_APP_DOWNLOAD_LINK: str({
			default: 'https://gauzy.co/downloads#mobile',
		}),
		EXTENSION_DOWNLOAD_LINK: str({
			default: 'https://gauzy.co/downloads#extensions',
		}),

		SENTRY_DSN: str({ default: '' }),
		SENTRY_TRACES_SAMPLE_RATE: str({ default: '' }),

		CLOUDINARY_CLOUD_NAME: str({ default: '' }),
		CLOUDINARY_API_KEY: str({ default: '' }),

		GOOGLE_MAPS_API_KEY: str({ default: '' }),
		GOOGLE_PLACE_AUTOCOMPLETE: bool({ default: false }),

		HUBSTAFF_REDIRECT_URL: str({ default: '' }),

		DEFAULT_LATITUDE: num({ default: 42.6459136 }),
		DEFAULT_LONGITUDE: num({ default: 23.3332736 }),
		DEFAULT_CURRENCY: str({ default: 'USD' }),
		DEFAULT_COUNTRY: str({ default: 'US' }),

		DEMO: bool({ default: false }),

		DEMO_SUPER_ADMIN_EMAIL: str({ default: 'admin@ever.co' }),
		DEMO_SUPER_ADMIN_PASSWORD: str({ default: 'admin' }),

		DEMO_ADMIN_EMAIL: str({ default: 'local.admin@ever.co' }),
		DEMO_ADMIN_PASSWORD: str({ default: 'admin' }),

		DEMO_EMPLOYEE_EMAIL: str({ default: 'employee@ever.co' }),
		DEMO_EMPLOYEE_PASSWORD: str({ default: '123456' }),

		CHATWOOT_SDK_TOKEN: str({ default: '' }),
		CHAT_MESSAGE_GOOGLE_MAP: str({ default: '' }),
		GAUZY_CLOUD_APP: str({ default: 'https://app.gauzy.co/#' }),

		FILE_PROVIDER: str({ default: 'LOCAL' }),

		JITSU_BROWSER_HOST: str({ default: '' }),
		JITSU_BROWSER_WRITE_KEY: str({ default: '' }),

		GAUZY_GITHUB_APP_NAME: str({ default: '' }),
		GAUZY_GITHUB_APP_ID: str({ default: '' }),
		GAUZY_GITHUB_CLIENT_ID: str({ default: '' }),
		GAUZY_GITHUB_REDIRECT_URL: str({ default: '' }),
	},
	{ strict: true, dotEnvPath: __dirname + '/../.env' }
);
