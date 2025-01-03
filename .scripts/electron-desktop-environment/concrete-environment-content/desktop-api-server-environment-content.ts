import { IContentGenerator } from '../interfaces/i-content-generator';
import { IDesktopEnvironment } from '../interfaces/i-desktop-environment';

export class DesktopApiServerEnvironmentContent implements IContentGenerator {
	/**
	 * Generates a string template based on the provided API server environment variables.
	 * If a specific API server variable is not available, it falls back to a generic one.
	 *
	 * @param {Partial<IDesktopEnvironment>} variable - A partial object containing environment variables.
	 * @returns {string} A string representation of the API server environment configuration.
	 *
	 * @example
	 * const environment = {
	 *     DESKTOP_API_SERVER_APP_NAME: 'API Server App',
	 *     NAME: 'Default App',
	 * };
	 * const result = generate(environment);
	 * console.log(result);
	 */
	public generate(variable: Partial<IDesktopEnvironment>): string {
		return `
			NAME: '${variable.DESKTOP_API_SERVER_APP_NAME || variable.NAME}',
			DESCRIPTION: '${variable.DESKTOP_API_SERVER_APP_DESCRIPTION || variable.DESCRIPTION}',
			APP_ID: '${variable.DESKTOP_API_SERVER_APP_ID || variable.APP_ID}',
			REPO_NAME: '${variable.DESKTOP_API_SERVER_APP_REPO_NAME || variable.REPO_NAME}',
			REPO_OWNER: '${variable.DESKTOP_API_SERVER_APP_REPO_OWNER || variable.REPO_OWNER}',
			WELCOME_TITLE: '${variable.DESKTOP_API_SERVER_APP_WELCOME_TITLE || variable.WELCOME_TITLE || ''}',
			WELCOME_CONTENT: '${variable.DESKTOP_API_SERVER_APP_WELCOME_CONTENT || variable.WELCOME_CONTENT || ''}',
			IS_DESKTOP_TIMER: ${false},
			IS_DESKTOP: ${false},
			IS_SERVER: ${true},
			IS_SERVER_API: ${true}
		`;
	}
}
