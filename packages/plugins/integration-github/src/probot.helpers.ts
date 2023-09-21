import { getPrivateKey } from '@probot/get-private-key';
import { Probot } from 'probot';
import SmeeClient from 'smee-client';
import { OctokitConfig, ProbotConfig } from './probot.types';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';


/**
 * Parse and restructure Probot configuration into a more organized format.
 * @param config - Probot configuration.
 * @returns Parsed configuration object.
 */
export const parseConfig = (config: ProbotConfig): Record<string, any> => ({
	appId: config.appId,
	privateKey: getPrivateKey({ env: { PRIVATE_KEY: config.privateKey } }) as string,
	webhookSecret: config.webhookSecret,
	ghUrl: config.ghUrl || 'https://api.github.com',
	webhookProxy: config.webhookProxy,
	webhookPath: config.webhookPath,
	clientId: config.clientId,
	clientSecret: config.clientSecret,
});

/**
 * Create and configure a Probot instance.
 * @param config - Probot configuration.
 * @returns A configured Probot instance.
 */
export const createProbot = (config: ProbotConfig): Probot => {
	const parsedConfig = parseConfig(config);

	return new Probot({
		...parsedConfig, // Spread the parsed configuration properties
	});
};

/**
 * Create and configure a SmeeClient instance.
 * @param config - Probot configuration.
 * @returns A configured SmeeClient instance.
 */
export const createSmee = (config: ProbotConfig): SmeeClient => {
	const parsedConfig = parseConfig(config);

	return new SmeeClient({
		source: parsedConfig.webhookProxy as string,
		target: parsedConfig.webhookPath as string,
		logger: console,
	});
};

/**
 * Create and configure an Octokit instance for GitHub API requests.
 * @param config - Configuration options for Octokit.
 * @returns An Octokit instance.
 */
export const createOctokit = (config: OctokitConfig): Octokit => {
	return new Octokit({
		authStrategy: createAppAuth,
		baseUrl: config.probot.ghUrl,
		auth: {
			appId: config.probot.appId,
			privateKey: config.probot.privateKey,
			clientId: config.probot.clientId,
			clientSecret: config.probot.clientSecret,
			...config.auth, // Include other auth options if needed
		},
	});
};
