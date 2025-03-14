
import { IContentGenerator } from '../interfaces/i-content-generator';
import { IDesktopEnvironment } from '../interfaces/i-desktop-environment';

export class AgentEnvironmentContent implements IContentGenerator {
	l
	/**
	 * Generates a string template based on the provided desktop environment variables.
	 * If a specific desktop variable is not available, it falls back to a generic one.
	 *
	 * @param {Partial<IDesktopEnvironment>} variable - A partial object containing environment variables.
	 * @returns {string} A string representation of the desktop environment configuration.
	 *
	 * @example
	 * const environment = {
	 *     DESKTOP_TIMER_APP_NAME: 'Timer App',
	 *     NAME: 'Default App',
	 * };
	 * const result = generate(environment);
	 * console.log(result);
	 */
	public generate(variable: Partial<IDesktopEnvironment>): string {
		return `
			NAME: '${variable.DESKTOP_TIMER_APP_NAME || variable.NAME}',
			DESCRIPTION: '${variable.DESKTOP_TIMER_APP_DESCRIPTION || variable.DESCRIPTION}',
			APP_ID: '${variable.DESKTOP_TIMER_APP_ID || variable.APP_ID}',
			REPO_NAME: '${variable.DESKTOP_TIMER_APP_REPO_NAME || variable.REPO_NAME}',
			REPO_OWNER: '${variable.DESKTOP_TIMER_APP_REPO_OWNER || variable.REPO_OWNER}',
			WELCOME_TITLE: '${variable.DESKTOP_TIMER_APP_WELCOME_TITLE || variable.WELCOME_TITLE || ''}',
			WELCOME_CONTENT: '${variable.DESKTOP_TIMER_APP_WELCOME_CONTENT || variable.WELCOME_CONTENT || ''}',
			IS_DESKTOP_TIMER: ${true},
			IS_DESKTOP: ${false},
			IS_SERVER: ${false},
			IS_SERVER_API: ${false}
		`;
	}
}
