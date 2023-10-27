import { IContentGenerator } from '../interfaces/i-content-generator';
import { Env } from '../../env';

export class DesktopServerEnvironmentContent implements IContentGenerator {
	public generate(variable: Partial<Env>): string {
		return `
			DESKTOP_SERVER_APP_NAME: '${variable.DESKTOP_SERVER_APP_NAME}',
			DESKTOP_SERVER_APP_DESCRIPTION: '${variable.DESKTOP_SERVER_APP_DESCRIPTION}',
			DESKTOP_SERVER_APP_ID: '${variable.DESKTOP_SERVER_APP_ID}',
			DESKTOP_SERVER_APP_REPO_NAME: '${variable.DESKTOP_SERVER_APP_REPO_NAME}',
			DESKTOP_SERVER_APP_REPO_OWNER: '${variable.DESKTOP_SERVER_APP_REPO_OWNER}',
			DESKTOP_SERVER_APP_WELCOME_TITLE: '${variable.DESKTOP_SERVER_APP_WELCOME_TITLE}',
			DESKTOP_SERVER_APP_WELCOME_CONTENT: '${variable.DESKTOP_SERVER_APP_WELCOME_CONTENT}',
			DESKTOP_SERVER_APP_I18N_FILES_URL: '${variable.DESKTOP_SERVER_APP_I18N_FILES_URL}',
		`;
	}
}
