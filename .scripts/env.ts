// NOTE: do NOT ever put here any secure settings! (e.g. Secret Keys)
// We are using dotenv (.env) for consistency with other Platform projects
// This is Angular app and all settings will be loaded into the client browser!

import { cleanEnv, num, str, bool } from 'envalid';

export type Env = Readonly<{
	production: boolean;

	API_BASE_URL: string;
}>;

export const env: Env = cleanEnv(
	process.env,
	{
		production: bool({ default: false }),
		API_BASE_URL: str({ default: 'http://localhost:3000' }),
		CLIENT_BASE_URL: str({ default: 'http://localhost:4200' })
	},
	{ strict: true, dotEnvPath: __dirname + '/../.env' }
);
