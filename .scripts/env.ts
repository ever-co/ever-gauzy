// NOTE: do NOT ever put here any secure settings! (e.g. Secret Keys)
// We are using dotenv (.env) for consistency with other Platform projects
// This is Angular app and all settings will be loaded into the client browser!

import { cleanEnv, num, str, bool } from 'envalid';

export type Env = Readonly<{
	production: boolean;
}>;

export const env: Env = cleanEnv(
	process.env,
	{
		production: bool({ default: false })		
	},
	{ strict: true, dotEnvPath: __dirname + '/../.env' }
);
