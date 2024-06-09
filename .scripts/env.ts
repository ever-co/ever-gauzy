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

	GAUZY_CLOUD_APP: string;

	FILE_PROVIDER: string;

	// Jitsu Browser Configurations
	JITSU_BROWSER_URL: string;
	JITSU_BROWSER_WRITE_KEY: string;

	GAUZY_GITHUB_APP_NAME: string;
	GAUZY_GITHUB_CLIENT_ID: string;
	GAUZY_GITHUB_REDIRECT_URL: string;
	GAUZY_GITHUB_POST_INSTALL_URL: string;

	GAUZY_DESKTOP_LOGO_512X512: string;
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

		JITSU_BROWSER_URL: str({ default: '' }),
		JITSU_BROWSER_WRITE_KEY: str({ default: '' }),

		GAUZY_GITHUB_APP_NAME: str({ default: '' }),
		GAUZY_GITHUB_CLIENT_ID: str({ default: '' }),
		GAUZY_GITHUB_REDIRECT_URL: str({ default: '' }),
		GAUZY_GITHUB_POST_INSTALL_URL: str({ default: '' }),

		// Set default platform logo
		PLATFORM_LOGO: str({
			default: 'assets/images/logos/logo_Gauzy.svg'
		}),

		//Set default gauzy desktop logo 512x512 pixels
		GAUZY_DESKTOP_LOGO_512X512: str({
			default: 'assets/icons/icon_512x512.png'
		}),

		// Set default platform privacy link
		PLATFORM_PRIVACY_URL: str({
			default: 'https://gauzy.co/privacy'
		}),

		// Set default platform terms of services link
		PLATFORM_TOS_URL: str({
			default: 'https://gauzy.co/tos'
		}),

		COMPANY_NAME: str({
			default: 'Ever Co. LTD'
		}),
		COMPANY_SITE: str({
			default: 'Gauzy'
		}),
		COMPANY_LINK: str({
			default: 'https://ever.co'
		}),
		COMPANY_SITE_LINK: str({
			default: 'https://gauzy.co'
		}),
		COMPANY_GITHUB_LINK: str({
			default: 'https://github.com/ever-co'
		}),
		COMPANY_GITLAB_LINK: str({
			default: 'https://gitlab.com/ever-co'
		}),
		COMPANY_FACEBOOK_LINK: str({
			default: 'https://www.facebook.com/gauzyplatform'
		}),
		COMPANY_TWITTER_LINK: str({
			default: 'https://twitter.com/gauzyplatform'
		}),
		COMPANY_LINKEDIN_LINK: str({
			default: 'https://www.linkedin.com/company/ever-co'
		}),
		NO_INTERNET_LOGO: str({
			default: 'assets/images/logos/logo_Gauzy.svg'
		}),
		PROJECT_REPO: str({
			default: 'https://github.com/ever-co/ever-gauzy.git'
		}),

		DESKTOP_TIMER_APP_NAME: str({
			default: 'gauzy-desktop-timer'
		}),
		DESKTOP_TIMER_APP_DESCRIPTION: str({
			default: 'Gauzy Desktop Timer'
		}),
		DESKTOP_TIMER_APP_ID: str({
			default: 'com.ever.gauzydesktoptimer'
		}),
		DESKTOP_TIMER_APP_REPO_NAME: str({
			default: 'ever-gauzy-desktop-timer'
		}),
		DESKTOP_TIMER_APP_REPO_OWNER: str({ default: 'ever-co' }),
		DESKTOP_TIMER_APP_WELCOME_TITLE: str({ default: '' }),
		DESKTOP_TIMER_APP_WELCOME_CONTENT: str({ default: '' }),

		DESKTOP_APP_NAME: str({
			default: 'gauzy-desktop'
		}),
		DESKTOP_APP_DESCRIPTION: str({
			default: 'Ever Gauzy Desktop'
		}),
		DESKTOP_APP_ID: str({
			default: 'com.ever.gauzydesktop'
		}),
		DESKTOP_APP_REPO_NAME: str({
			default: 'ever-gauzy-desktop'
		}),
		DESKTOP_APP_REPO_OWNER: str({ default: 'ever-co' }),
		DESKTOP_APP_WELCOME_TITLE: str({ default: '' }),
		DESKTOP_APP_WELCOME_CONTENT: str({ default: '' }),

		DESKTOP_SERVER_APP_NAME: str({
			default: 'gauzy-server'
		}),
		DESKTOP_SERVER_APP_DESCRIPTION: str({
			default: 'Ever Gauzy Server'
		}),
		DESKTOP_SERVER_APP_ID: str({
			default: 'com.ever.gauzyserver'
		}),
		DESKTOP_SERVER_APP_REPO_NAME: str({
			default: 'ever-gauzy-server'
		}),
		DESKTOP_SERVER_APP_REPO_OWNER: str({ default: 'ever-co' }),
		DESKTOP_SERVER_APP_WELCOME_TITLE: str({ default: '' }),
		DESKTOP_SERVER_APP_WELCOME_CONTENT: str({ default: '' }),

		I18N_FILES_URL: str({ default: '' }),
		AWHost: str({ default: 'http://localhost:5600' }),
		API_DEFAULT_PORT: num({ default: 3000 }),
		GAUZY_UI_DEFAULT_PORT: num({ default: 5621 }),
		SCREENSHOTS_ENGINE_METHOD: str({ default: 'ScreenshotDesktopLib' }),

		DESKTOP_API_SERVER_APP_NAME: str({
			default: 'gauzy-api-server'
		}),
		DESKTOP_API_SERVER_APP_DESCRIPTION: str({
			default: 'Gauzy API Server'
		}),
		DESKTOP_API_SERVER_APP_ID: str({
			default: 'com.ever.gauzyapiserver'
		}),
		DESKTOP_API_SERVER_APP_REPO_NAME: str({
			default: 'ever-gauzy-api-server'
		}),
		DESKTOP_API_SERVER_APP_REPO_OWNER: str({ default: 'ever-co' }),
		DESKTOP_API_SERVER_APP_WELCOME_TITLE: str({ default: '' }),
		DESKTOP_API_SERVER_APP_WELCOME_CONTENT: str({ default: '' })
	},
	{ strict: true, dotEnvPath: __dirname + '/../.env' }
);
