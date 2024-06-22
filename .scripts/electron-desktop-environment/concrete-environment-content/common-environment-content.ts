import { IContentGenerator } from '../interfaces/i-content-generator';
import { Env } from '../../env';

export class CommonEnvironmentContent implements IContentGenerator {
	public generate(variable: Partial<Env>): string {
		return `
			AWHost: '${variable.AWHost}',
			API_DEFAULT_PORT:  ${variable.API_DEFAULT_PORT},
			GAUZY_UI_DEFAULT_PORT: ${variable.GAUZY_UI_DEFAULT_PORT},
			SCREENSHOTS_ENGINE_METHOD: '${variable.SCREENSHOTS_ENGINE_METHOD}', // ElectronDesktopCapturer || ScreenshotDesktopLib
			SENTRY_DSN: '${variable.SENTRY_DSN}',
			SENTRY_TRACES_SAMPLE_RATE: '${variable.SENTRY_TRACES_SAMPLE_RATE}',
			PLATFORM_LOGO: '${variable.PLATFORM_LOGO}',
			PROJECT_REPO: '${variable.PROJECT_REPO}',
			COMPANY_SITE_LINK: '${variable.COMPANY_SITE_LINK}',
			I4NET_DESKTOP_LOGO_512X512: '${variable.I4NET_DESKTOP_LOGO_512X512}',
			NO_INTERNET_LOGO: '${variable.NO_INTERNET_LOGO}',
			I18N_FILES_URL: '${variable.I18N_FILES_URL}',
		`;
	}
}
