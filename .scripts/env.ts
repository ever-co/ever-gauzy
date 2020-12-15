// NOTE: do NOT ever put here any secure settings! (e.g. Secret Keys)
// We are using dotenv (.env) for consistency with other Platform projects
// This is Angular app and all settings will be loaded into the client browser!

import { cleanEnv, str, bool, num } from 'envalid';

export type Env = Readonly<{
	production: boolean;
	API_BASE_URL: string;
	GOOGLE_MAPS_API_KEY: string;
	DEFAULT_LATITUDE: number;
	DEFAULT_LONGITUDE: number;
	DEFAULT_CURRENCY: string;
}>;

export const env: Env = cleanEnv(
	process.env,
	{
		production: bool({ default: false }),
		API_BASE_URL: str({ default: 'http://localhost:3000' }),
		CLIENT_BASE_URL: str({ default: 'http://localhost:4200' }),
		GOOGLE_MAPS_API_KEY: str({ default: '' }),
		DEFAULT_LATITUDE: num({ default: 42.6459136 }),
		DEFAULT_LONGITUDE: num({ default: 23.3332736 }),
		DEFAULT_CURRENCY: str({ default: 'USD' })
	},
	{ strict: true, dotEnvPath: __dirname + '/../.env' }
);
