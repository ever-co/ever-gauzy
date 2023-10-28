import { IContentGenerator } from '../interfaces/i-content-generator';
import { IDesktopEnvironment } from '../interfaces/i-desktop-environment';

export class DesktopEnvironmentContent implements IContentGenerator {
	public generate(variable: Partial<IDesktopEnvironment>): string {
		return `
			NAME: '${variable.DESKTOP_APP_NAME || variable.NAME}',
			DESCRIPTION: '${variable.DESKTOP_APP_DESCRIPTION || variable.DESCRIPTION}',
			APP_ID: '${variable.DESKTOP_APP_ID || variable.APP_ID}',
			REPO_NAME: '${variable.DESKTOP_APP_REPO_NAME || variable.REPO_NAME}',
			REPO_OWNER: '${variable.DESKTOP_APP_REPO_OWNER || variable.REPO_OWNER}',
			WELCOME_TITLE: '${variable.DESKTOP_APP_WELCOME_TITLE || variable.WELCOME_TITLE || ''}',
			WELCOME_CONTENT: '${variable.DESKTOP_APP_WELCOME_CONTENT || variable.WELCOME_CONTENT || ''}',
			I18N_FILES_URL: '${variable.DESKTOP_APP_I18N_FILES_URL || variable.I18N_FILES_URL || ''}',
			IS_DESKTOP_TIMER: ${false},
			IS_DESKTOP: ${true},
			IS_SERVER: ${false},
		`;
	}
}
