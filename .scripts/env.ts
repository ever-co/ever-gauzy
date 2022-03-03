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

	SENTRY_DSN: string;

	CLOUDINARY_CLOUD_NAME: string;
	CLOUDINARY_API_KEY: string;

	GOOGLE_MAPS_API_KEY: string;
	GOOGLE_PLACE_AUTOCOMPLETE: boolean;

	HUBSTAFF_REDIRECT_URI: string;

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
}>;

export const env: Env = cleanEnv(
	process.env,
	{
		production: bool({ default: false }),

		IS_DOCKER: bool({ default: false }),

		CLIENT_BASE_URL: str({ default: 'http://localhost:4200' }),

		API_BASE_URL: str({ default: 'http://localhost:3000' }),

		SENTRY_DSN: str({ default: '' }),

		CLOUDINARY_CLOUD_NAME: str({ default: '' }),
		CLOUDINARY_API_KEY: str({ default: '' }),

		GOOGLE_MAPS_API_KEY: str({ default: '' }),
		GOOGLE_PLACE_AUTOCOMPLETE: bool({ default: false }),

		HUBSTAFF_REDIRECT_URI: str({ default: 'http://localhost:3000/api/integrations/hubstaff/callback' }),

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

		FILE_PROVIDER: str({ default: 'WASABI' }),
	},
	{ strict: true, dotEnvPath: __dirname + '/../.env' }
);
