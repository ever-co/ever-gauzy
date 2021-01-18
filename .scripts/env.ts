// NOTE: do NOT ever put here any secure settings! (e.g. Secret Keys)
// We are using dotenv (.env) for consistency with other Platform projects
// This is Angular app and all settings will be loaded into the client browser!

import { cleanEnv, str, bool, num } from 'envalid';

export type Env = Readonly<{
	production: boolean;
	API_BASE_URL: string;
	SENTRY_DSN: string;
	GOOGLE_MAPS_API_KEY: string;
	GOOGLE_PLACE_AUTOCOMPLETE: boolean;
	DEFAULT_LATITUDE: number;
	DEFAULT_LONGITUDE: number;
	DEFAULT_CURRENCY: string;
	DEMO: boolean;
}>;

export const env: Env = cleanEnv(
	process.env,
	{
		production: bool({ default: false }),
		API_BASE_URL: str({ default: 'http://localhost:3000' }),
		CLIENT_BASE_URL: str({ default: 'http://localhost:4200' }),
		GOOGLE_MAPS_API_KEY: str({ default: '' }),
		GOOGLE_PLACE_AUTOCOMPLETE: bool({ default: false }),
		SENTRY_DSN: str({ default: '' }),
		DEFAULT_LATITUDE: num({ default: 42.6459136 }),
		DEFAULT_LONGITUDE: num({ default: 23.3332736 }),
		DEFAULT_CURRENCY: str({ default: 'USD' }),
		DEMO: bool({ default: false })
	},
	{ strict: true, dotEnvPath: __dirname + '/../.env' }
);
