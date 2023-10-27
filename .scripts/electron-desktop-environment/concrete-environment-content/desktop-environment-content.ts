import { IContentGenerator } from '../interfaces/i-content-generator';
import { Env } from '../../env';

export class DesktopEnvironmentContent implements IContentGenerator {
	public generate(variable: Partial<Env>): string {
		return `
			DESKTOP_APP_NAME: '${variable.DESKTOP_APP_NAME}',
			DESKTOP_APP_DESCRIPTION: '${variable.DESKTOP_APP_DESCRIPTION}',
			DESKTOP_APP_ID: '${variable.DESKTOP_APP_ID}',
			DESKTOP_APP_REPO_NAME: '${variable.DESKTOP_APP_REPO_NAME}',
			DESKTOP_APP_REPO_OWNER: '${variable.DESKTOP_APP_REPO_OWNER}',
			DESKTOP_APP_WELCOME_TITLE: '${variable.DESKTOP_APP_WELCOME_TITLE}',
			DESKTOP_APP_WELCOME_CONTENT: '${variable.DESKTOP_APP_WELCOME_CONTENT}',
			DESKTOP_APP_I18N_FILES_URL: '${variable.DESKTOP_APP_I18N_FILES_URL}',
		`;
	}
}
