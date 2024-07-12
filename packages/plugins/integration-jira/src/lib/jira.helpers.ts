import { JiraConfig, JiraModuleOptions } from './jira.types';

/**
 * Parses the provided Jira configuration object and returns a new JiraConfig object.
 *
 * @param {JiraConfig} config - The Jira configuration object.
 * @returns {JiraConfig} The parsed Jira configuration.
 */
export const parseConfig = (config: JiraConfig): JiraConfig => ({
	appName: config.appName,
	appDescription: config.appDescription,
	appKey: config.appKey,
	baseUrl: config.baseUrl,
	vendorName: config.vendorName,
	vendorUrl: config.vendorUrl
});

/**
 * Parses the provided Jira module options and returns a new JiraModuleOptions object.
 *
 * @param {JiraModuleOptions} options - The Jira module options.
 * @returns {JiraModuleOptions} The parsed Jira module options.
 */
export const parseOptions = (options: JiraModuleOptions): JiraModuleOptions => ({
	isGlobal: options.isGlobal || false,
	path: options.path,
	config: parseConfig(options.config)
});
