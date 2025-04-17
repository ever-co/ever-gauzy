// NOTE: do NOT ever put here any secure settings! (e.g. Secret Keys)
// We are using dotenv (.env) for consistency with other Platform projects
// This is Angular app and all settings will be loaded into the client browser!

import { cleanEnv, str, bool, num } from 'envalid';

export type Env = Readonly<{
	production: boolean;

	// Set to true if build / runs in Docker
	IS_DOCKER: boolean;

	COOKIE_DOMAIN: string;

	// Base URL of DSpot ERP UI website
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

	// Jitsu Browser Configurations
	JITSU_BROWSER_URL: string;
	JITSU_BROWSER_WRITE_KEY: string;

	GAUZY_GITHUB_APP_NAME: string;
	GAUZY_GITHUB_CLIENT_ID: string;
	GAUZY_GITHUB_REDIRECT_URL: string;
	GAUZY_GITHUB_POST_INSTALL_URL: string;

	PLATFORM_PRIVACY_URL: string;
	PLATFORM_TOS_URL: string;

	COMPANY_NAME: string;
	COMPANY_LINK: string;
	COMPANY_SITE_NAME: string;
	COMPANY_SITE_LINK: string;
	COMPANY_GITHUB_LINK: string;
	COMPANY_GITLAB_LINK: string;
	COMPANY_FACEBOOK_LINK: string;
	COMPANY_TWITTER_LINK: string;
	COMPANY_IN_LINK: string;
	PROJECT_REPO: string;

	DESKTOP_TIMER_APP_NAME: string;
	DESKTOP_TIMER_APP_DESCRIPTION: string;
	DESKTOP_TIMER_APP_ID: string;
	DESKTOP_TIMER_APP_REPO_NAME: string;
	DESKTOP_TIMER_APP_REPO_OWNER: string;
	DESKTOP_TIMER_APP_WELCOME_TITLE: string;
	DESKTOP_TIMER_APP_WELCOME_CONTENT: string;

	DESKTOP_APP_NAME: string;
	DESKTOP_APP_DESCRIPTION: string;
	DESKTOP_APP_ID: string;
	DESKTOP_APP_REPO_NAME: string;
	DESKTOP_APP_REPO_OWNER: string;
	DESKTOP_APP_WELCOME_TITLE: string;
	DESKTOP_APP_WELCOME_CONTENT: string;

	DESKTOP_SERVER_APP_NAME: string;
	DESKTOP_SERVER_APP_DESCRIPTION: string;
	DESKTOP_SERVER_APP_ID: string;
	DESKTOP_SERVER_APP_REPO_NAME: string;
	DESKTOP_SERVER_APP_REPO_OWNER: string;
	DESKTOP_SERVER_APP_WELCOME_TITLE: string;
	DESKTOP_SERVER_APP_WELCOME_CONTENT: string;

	DESKTOP_API_SERVER_APP_NAME: string;
	DESKTOP_API_SERVER_APP_DESCRIPTION: string;
	DESKTOP_API_SERVER_APP_ID: string;
	DESKTOP_API_SERVER_APP_REPO_NAME: string;
	DESKTOP_API_SERVER_APP_REPO_OWNER: string;
	DESKTOP_API_SERVER_APP_WELCOME_TITLE: string;
	DESKTOP_API_SERVER_APP_WELCOME_CONTENT: string;

	AWHost: string;
	API_DEFAULT_PORT: number;
	GAUZY_UI_DEFAULT_PORT: number;
	SCREENSHOTS_ENGINE_METHOD: string;
	I18N_FILES_URL: string;

	REGISTER_URL: string;
	FORGOT_PASSWORD_URL: string;
}>;

export const env: Env = cleanEnv(
	process.env,
	{
		production: bool({ default: false }),

		IS_DOCKER: bool({ default: false }),

		COOKIE_DOMAIN: str({ default: '.gauzy.co' }),

		CLIENT_BASE_URL: str({ default: 'http://localhost:4200' }),

		API_BASE_URL: str({ default: 'http://localhost:3000' }),

		PLATFORM_WEBSITE_URL: str({ default: 'https://gauzy.co' }),
		PLATFORM_WEBSITE_DOWNLOAD_URL: str({
			default: 'https://gauzy.co/downloads'
		}),
		DESKTOP_APP_DOWNLOAD_LINK_APPLE: str({
			default: 'https://gauzy.co/downloads#desktop/apple'
		}),
		DESKTOP_APP_DOWNLOAD_LINK_WINDOWS: str({
			default: 'https://gauzy.co/downloads#desktop/windows'
		}),
		DESKTOP_APP_DOWNLOAD_LINK_LINUX: str({
			default: 'https://gauzy.co/downloads#desktop/linux'
		}),
		MOBILE_APP_DOWNLOAD_LINK: str({
			default: 'https://gauzy.co/downloads#mobile'
		}),
		EXTENSION_DOWNLOAD_LINK: str({
			default: 'https://gauzy.co/downloads#extensions'
		}),

		SENTRY_DSN: str({ default: '' }),
		SENTRY_TRACES_SAMPLE_RATE: str({ default: '' }),

		GOOGLE_MAPS_API_KEY: str({ default: '' }),
		GOOGLE_PLACE_AUTOCOMPLETE: bool({ default: false }),

		HUBSTAFF_REDIRECT_URL: str({ default: '' }),

		DEFAULT_LATITUDE: num({ default: 42.6459136 }),
		DEFAULT_LONGITUDE: num({ default: 23.3332736 }),
		DEFAULT_CURRENCY: str({ default: 'USD' }),
		DEFAULT_COUNTRY: str({ default: 'US' }),

		DEMO: bool({ default: false }),

		DEMO_SUPER_ADMIN_EMAIL: str({ default: 'admin@dspot.com.pl' }),
		DEMO_SUPER_ADMIN_PASSWORD: str({ default: 'admin' }),

		DEMO_ADMIN_EMAIL: str({ default: 'local.admin@dspot.com.pl' }),
		DEMO_ADMIN_PASSWORD: str({ default: 'admin' }),

		DEMO_EMPLOYEE_EMAIL: str({ default: 'employee@dspot.com.pl' }),
		DEMO_EMPLOYEE_PASSWORD: str({ default: '123456' }),

		CHATWOOT_SDK_TOKEN: str({ default: '' }),
		CHAT_MESSAGE_GOOGLE_MAP: str({ default: '' }),
		GAUZY_CLOUD_APP: str({ default: 'https://app.gauzy.co/#' }),

		FILE_PROVIDER: str({ default: 'LOCAL' }),

		JITSU_BROWSER_URL: str({ default: '' }),
		JITSU_BROWSER_WRITE_KEY: str({ default: '' }),

		GAUZY_GITHUB_APP_NAME: str({ default: '' }),
		GAUZY_GITHUB_CLIENT_ID: str({ default: '' }),
		GAUZY_GITHUB_REDIRECT_URL: str({ default: '' }),
		GAUZY_GITHUB_POST_INSTALL_URL: str({ default: '' }),

		// Set default platform privacy link
		PLATFORM_PRIVACY_URL: str({
			default: 'https://gauzy.co/privacy'
		}),

		// Set default platform terms of services link
		PLATFORM_TOS_URL: str({
			default: 'https://gauzy.co/tos'
		}),

		COMPANY_NAME: str({
			default: 'DSpot sp. z o.o.'
		}),
		COMPANY_LINK: str({
			default: 'https://www.dspot.com.pl'
		}),
		COMPANY_SITE_NAME: str({
			default: 'DSpot ERP'
		}),
		COMPANY_SITE_LINK: str({
			default: 'https://www.dspot.com.pl'
		}),
		COMPANY_GITHUB_LINK: str({
			default: 'https://github.com/DSpotDevelopers'
		}),
		COMPANY_GITLAB_LINK: str({
			default: 'https://gitlab.com/DSpotDevelopers'
		}),
		COMPANY_FACEBOOK_LINK: str({
			default: 'https://www.facebook.com/DSpotTeam'
		}),
		COMPANY_TWITTER_LINK: str({
			default: 'https://x.com/DSpotTeam'
		}),
		COMPANY_IN_LINK: str({
			default: 'https://www.linkedin.com/company/dspotteam'
		}),
		PROJECT_REPO: str({
			default: 'https://github.com/DSpotDevelopers/gauzy'
		}),

		DESKTOP_TIMER_APP_NAME: str({
			default: 'dspot-erp-desktop-timer'
		}),
		DESKTOP_TIMER_APP_DESCRIPTION: str({
			default: 'DSpot ERP Desktop Timer'
		}),
		DESKTOP_TIMER_APP_ID: str({
			default: 'pl.com.dspot.erpdesktoptimer'
		}),
		DESKTOP_TIMER_APP_REPO_NAME: str({
			default: 'dspot-erp-desktop-timer'
		}),
		DESKTOP_TIMER_APP_REPO_OWNER: str({ default: 'DSpot' }),
		DESKTOP_TIMER_APP_WELCOME_TITLE: str({ default: '' }),
		DESKTOP_TIMER_APP_WELCOME_CONTENT: str({ default: '' }),

		DESKTOP_APP_NAME: str({
			default: 'dspot-erp-desktop'
		}),
		DESKTOP_APP_DESCRIPTION: str({
			default: 'DSpot ERP Desktop'
		}),
		DESKTOP_APP_ID: str({
			default: 'pl.com.dspot.erpdesktop'
		}),
		DESKTOP_APP_REPO_NAME: str({
			default: 'dspot-erp-desktop'
		}),
		DESKTOP_APP_REPO_OWNER: str({ default: 'DSpot' }),
		DESKTOP_APP_WELCOME_TITLE: str({ default: '' }),
		DESKTOP_APP_WELCOME_CONTENT: str({ default: '' }),

		DESKTOP_SERVER_APP_NAME: str({
			default: 'dspot-erp-server'
		}),
		DESKTOP_SERVER_APP_DESCRIPTION: str({
			default: 'DSpot ERP Server'
		}),
		DESKTOP_SERVER_APP_ID: str({
			default: 'pl.com.dspot.erpserver'
		}),
		DESKTOP_SERVER_APP_REPO_NAME: str({
			default: 'dspot-erp-server'
		}),
		DESKTOP_SERVER_APP_REPO_OWNER: str({ default: 'DSpot' }),
		DESKTOP_SERVER_APP_WELCOME_TITLE: str({ default: '' }),
		DESKTOP_SERVER_APP_WELCOME_CONTENT: str({ default: '' }),

		I18N_FILES_URL: str({ default: '' }),
		AWHost: str({ default: 'http://localhost:5600' }),
		API_DEFAULT_PORT: num({ default: 3000 }),
		GAUZY_UI_DEFAULT_PORT: num({ default: 5621 }),
		SCREENSHOTS_ENGINE_METHOD: str({ default: 'ScreenshotDesktopLib' }),

		DESKTOP_API_SERVER_APP_NAME: str({
			default: 'dspot-erp-api-server'
		}),
		DESKTOP_API_SERVER_APP_DESCRIPTION: str({
			default: 'DSpot ERP API Server'
		}),
		DESKTOP_API_SERVER_APP_ID: str({
			default: 'pl.com.dspot.erpapiserver'
		}),
		DESKTOP_API_SERVER_APP_REPO_NAME: str({
			default: 'dspot-erp-api-server'
		}),
		DESKTOP_API_SERVER_APP_REPO_OWNER: str({ default: 'DSpot' }),
		DESKTOP_API_SERVER_APP_WELCOME_TITLE: str({ default: '' }),
		DESKTOP_API_SERVER_APP_WELCOME_CONTENT: str({ default: '' }),

		REGISTER_URL: str({ default: 'https://app.gauzy.co/#/auth/register' }),
		FORGOT_PASSWORD_URL: str({ default: 'https://app.gauzy.co/#/auth/request-password' })
	},
	{ strict: true, dotEnvPath: __dirname + '/../.env' }
);
