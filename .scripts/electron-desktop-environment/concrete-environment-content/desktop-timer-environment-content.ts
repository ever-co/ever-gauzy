import { IContentGenerator } from '../interfaces/i-content-generator';
import { Env } from '../../env';

export class DesktopTimerEnvironmentContent implements IContentGenerator {
	public generate(variable: Partial<Env>): string {
		return `
			DESKTOP_TIMER_APP_NAME: '${variable.DESKTOP_TIMER_APP_NAME}',
			DESKTOP_TIMER_APP_DESCRIPTION: '${variable.DESKTOP_TIMER_APP_DESCRIPTION}',
			DESKTOP_TIMER_APP_ID: '${variable.DESKTOP_TIMER_APP_ID}',
			DESKTOP_TIMER_APP_REPO_NAME: '${variable.DESKTOP_TIMER_APP_REPO_NAME}',
			DESKTOP_TIMER_APP_REPO_OWNER: '${variable.DESKTOP_TIMER_APP_REPO_OWNER}',
			DESKTOP_TIMER_APP_WELCOME_TITLE: '${variable.DESKTOP_TIMER_APP_WELCOME_TITLE}',
			DESKTOP_TIMER_APP_WELCOME_CONTENT: '${variable.DESKTOP_TIMER_APP_WELCOME_CONTENT}',
			DESKTOP_TIMER_APP_I18N_FILES_URL: '${variable.DESKTOP_TIMER_APP_I18N_FILES_URL}',
		`;
	}
}
