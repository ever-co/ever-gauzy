import { Env } from '../../env';

export interface IDesktopEnvironment extends Env {
	NAME: string;
	DESCRIPTION: string;
	APP_ID: string;
	REPO_NAME: string;
	REPO_OWNER: string;
	WELCOME_TITLE: string;
	WELCOME_CONTENT: string;
	PROTOCOL: string;
	I18N_FILES_URL: string;
	IS_DESKTOP_TIMER: boolean;
	IS_DESKTOP: boolean;
	IS_SERVER: boolean;
	IS_SERVER_API: boolean;
	IS_AGENT: boolean;
	DESKTOP_JWT_SECRET: string;
	DESKTOP_JWT_REFRESH_TOKEN_SECRET: string;
}
