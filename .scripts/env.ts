// NOTE: do NOT ever put here any secure settings! (e.g. Secret Keys)
// We are using dotenv (.env) for consistency with other Platform projects
// This is Angular app and all settings will be loaded into the client browser!

import { cleanEnv, str, bool, num } from 'envalid';

export type Env = Readonly<{
	production: boolean;

	// Set to true if build / runs in Docker
	IS_DOCKER: boolean;

	// Base URL of i4net UI website
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

	// Platform logo url
	PLATFORM_LOGO: string;

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

	I4NET_CLOUD_APP: string;

	FILE_PROVIDER: string;

	// Jitsu Browser Configurations
	JITSU_BROWSER_URL: string;
	JITSU_BROWSER_WRITE_KEY: string;

	I4NET_GITHUB_APP_NAME: string;
	I4NET_GITHUB_CLIENT_ID: string;
	I4NET_GITHUB_REDIRECT_URL: string;
	I4NET_GITHUB_POST_INSTALL_URL: string;

	I4NET_DESKTOP_LOGO_512X512: string;
	PLATFORM_PRIVACY_URL: string;
	PLATFORM_TOS_URL: string;
	NO_INTERNET_LOGO: string;

	COMPANY_NAME: string;
	COMPANY_SITE: string;
	COMPANY_LINK: string;
	COMPANY_SITE_LINK: string;
	COMPANY_GITHUB_LINK: string;
	COMPANY_GITLAB_LINK: string;
	COMPANY_FACEBOOK_LINK: string;
	COMPANY_TWITTER_LINK: string;
	COMPANY_LINKEDIN_LINK: string;
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
}>;

export const env: Env = cleanEnv(
	process.env,
	{
		production: bool({ default: false }),

		IS_DOCKER: bool({ default: false }),

		CLIENT_BASE_URL: str({ default: 'http://localhost:4200' }),

		API_BASE_URL: str({ default: 'http://localhost:3800' }),

		PLATFORM_WEBSITE_URL: str({ default: 'https://i4net.co.il' }),
		PLATFORM_WEBSITE_DOWNLOAD_URL: str({
			default: 'https://i4net.co.il/downloads'
		}),
		DESKTOP_APP_DOWNLOAD_LINK_APPLE: str({
			default: 'https://i4net.co.il/downloads#desktop/apple'
		}),
		DESKTOP_APP_DOWNLOAD_LINK_WINDOWS: str({
			default: 'https://i4net.co.il/downloads#desktop/windows'
		}),
		DESKTOP_APP_DOWNLOAD_LINK_LINUX: str({
			default: 'https://i4net.co.il/downloads#desktop/linux'
		}),
		MOBILE_APP_DOWNLOAD_LINK: str({
			default: 'https://i4net.co.il/downloads#mobile'
		}),
		EXTENSION_DOWNLOAD_LINK: str({
			default: 'https://i4net.co.il/downloads#extensions'
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

		DEMO_SUPER_ADMIN_EMAIL: str({ default: 'admin@ever.co' }),
		DEMO_SUPER_ADMIN_PASSWORD: str({ default: 'admin' }),

		DEMO_ADMIN_EMAIL: str({ default: 'local.admin@ever.co' }),
		DEMO_ADMIN_PASSWORD: str({ default: 'admin' }),

		DEMO_EMPLOYEE_EMAIL: str({ default: 'employee@ever.co' }),
		DEMO_EMPLOYEE_PASSWORD: str({ default: '123456' }),

		CHATWOOT_SDK_TOKEN: str({ default: '' }),
		CHAT_MESSAGE_GOOGLE_MAP: str({ default: '' }),
		I4NET_CLOUD_APP: str({ default: 'https://app.i4net.co.il/#' }),

		FILE_PROVIDER: str({ default: 'LOCAL' }),

		JITSU_BROWSER_URL: str({ default: '' }),
		JITSU_BROWSER_WRITE_KEY: str({ default: '' }),

		I4NET_GITHUB_APP_NAME: str({ default: '' }),
		I4NET_GITHUB_CLIENT_ID: str({ default: '' }),
		I4NET_GITHUB_REDIRECT_URL: str({ default: '' }),
		I4NET_GITHUB_POST_INSTALL_URL: str({ default: '' }),

		// Set default platform logo
		PLATFORM_LOGO: str({
			default: 'assets/images/logos/logo_i4net.png'
		}),

		//Set default i4net Desktop logo 512x512 pixels
		I4NET_DESKTOP_LOGO_512X512: str({
			default: 'assets/icons/icon_512x512.png'
		}),

		// Set default platform privacy link
		PLATFORM_PRIVACY_URL: str({
			default: 'https://i4net.co.il/privacy'
		}),

		// Set default platform terms of services link
		PLATFORM_TOS_URL: str({
			default: 'https://i4net.co.il/tos'
		}),

		COMPANY_NAME: str({
			default: 'i4net'
		}),
		COMPANY_SITE: str({
			default: 'i4net'
		}),
		COMPANY_LINK: str({
			default: 'https://i4net.co.il'
		}),
		COMPANY_SITE_LINK: str({
			default: 'https://i4net.co.il'
		}),
		COMPANY_GITHUB_LINK: str({
			default: 'https://github.com/i4net'
		}),
		COMPANY_GITLAB_LINK: str({
			default: 'https://gitlab.com/i4net'
		}),
		COMPANY_FACEBOOK_LINK: str({
			default: 'https://www.facebook.com/i4net'
		}),
		COMPANY_TWITTER_LINK: str({
			default: 'https://twitter.com/i4net'
		}),
		COMPANY_LINKEDIN_LINK: str({
			default: 'https://www.linkedin.com/company/i4net'
		}),
		NO_INTERNET_LOGO: str({
			default: 'assets/images/logos/logo_i4net.png'
		}),
		PROJECT_REPO: str({
			default: 'https://github.com/i4net/i4net.git'
		}),

		DESKTOP_TIMER_APP_NAME: str({
			default: 'i4net-desktop-timer'
		}),
		DESKTOP_TIMER_APP_DESCRIPTION: str({
			default: 'i4net Desktop Timer'
		}),
		DESKTOP_TIMER_APP_ID: str({
			default: 'com.i4net.i4netdesktoptimer'
		}),
		DESKTOP_TIMER_APP_REPO_NAME: str({
			default: 'i4net-desktop-timer'
		}),
		DESKTOP_TIMER_APP_REPO_OWNER: str({ default: 'i4net' }),
		DESKTOP_TIMER_APP_WELCOME_TITLE: str({ default: '' }),
		DESKTOP_TIMER_APP_WELCOME_CONTENT: str({ default: '' }),

		DESKTOP_APP_NAME: str({
			default: 'i4net-desktop'
		}),
		DESKTOP_APP_DESCRIPTION: str({
			default: 'i4net Desktop'
		}),
		DESKTOP_APP_ID: str({
			default: 'com.i4net.i4netdesktop'
		}),
		DESKTOP_APP_REPO_NAME: str({
			default: 'i4net-desktop'
		}),
		DESKTOP_APP_REPO_OWNER: str({ default: 'i4net' }),
		DESKTOP_APP_WELCOME_TITLE: str({ default: '' }),
		DESKTOP_APP_WELCOME_CONTENT: str({ default: '' }),

		DESKTOP_SERVER_APP_NAME: str({
			default: 'i4net-server'
		}),
		DESKTOP_SERVER_APP_DESCRIPTION: str({
			default: 'i4net Server'
		}),
		DESKTOP_SERVER_APP_ID: str({
			default: 'com.i4net.i4netserver'
		}),
		DESKTOP_SERVER_APP_REPO_NAME: str({
			default: 'i4net-server'
		}),
		DESKTOP_SERVER_APP_REPO_OWNER: str({ default: 'i4net' }),
		DESKTOP_SERVER_APP_WELCOME_TITLE: str({ default: '' }),
		DESKTOP_SERVER_APP_WELCOME_CONTENT: str({ default: '' }),

		I18N_FILES_URL: str({ default: '' }),
		AWHost: str({ default: 'http://localhost:5600' }),
		API_DEFAULT_PORT: num({ default: 3800 }),
		GAUZY_UI_DEFAULT_PORT: num({ default: 5621 }),
		SCREENSHOTS_ENGINE_METHOD: str({ default: 'ScreenshotDesktopLib' }),

		DESKTOP_API_SERVER_APP_NAME: str({
			default: 'i4net-api-server'
		}),
		DESKTOP_API_SERVER_APP_DESCRIPTION: str({
			default: 'i4net API Server'
		}),
		DESKTOP_API_SERVER_APP_ID: str({
			default: 'com.i4net.i4netapiserver'
		}),
		DESKTOP_API_SERVER_APP_REPO_NAME: str({
			default: 'i4net-api-server'
		}),
		DESKTOP_API_SERVER_APP_REPO_OWNER: str({ default: 'i4net' }),
		DESKTOP_API_SERVER_APP_WELCOME_TITLE: str({ default: '' }),
		DESKTOP_API_SERVER_APP_WELCOME_CONTENT: str({ default: '' })
	},
	{ strict: true, dotEnvPath: __dirname + '/../.env' }
);
