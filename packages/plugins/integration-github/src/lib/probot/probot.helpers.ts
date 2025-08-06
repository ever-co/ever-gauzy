import SmeeClient from 'smee-client';
import type { Probot } from 'probot';
import type { Octokit } from '@octokit/rest';
import { OctokitConfig, ProbotConfig } from './probot.types';

// GITHUB API URL
export const GITHUB_API_URL = 'https://api.github.com';

/**
 * Dynamically import getPrivateKey from @probot/get-private-key (ESM module)
 * @param privateKey - The private key string
 * @returns Promise<string> - The processed private key
 */
async function getPrivateKeyAsync(privateKey: string): Promise<string> {
	try {
		// Dynamic import for ESM module compatibility
		const { getPrivateKey } = await import('@probot/get-private-key');
		return getPrivateKey({
			env: { PRIVATE_KEY: privateKey ? privateKey.replace(/\\n/g, '\n') : '' }
		}) as string;
	} catch (error) {
		console.error('Error importing @probot/get-private-key:', error);
		// Fallback: return the processed private key directly
		return privateKey ? privateKey.replace(/\\n/g, '\n') : '';
	}
}

/**
 * Parse and restructure Probot configuration into a more organized format.
 * @param config - Probot configuration.
 * @returns Promise<Record<string, any>> - Parsed configuration object.
 */
export const parseConfig = async (config: ProbotConfig): Promise<Record<string, any>> => {
	const privateKey = await getPrivateKeyAsync(config.privateKey);

	return {
		appId: config.appId,
		privateKey,
		webhookSecret: config.webhookSecret,
		ghUrl: config.ghUrl || GITHUB_API_URL,
		webhookProxy: config.webhookProxy,
		webhookPath: config.webhookPath,
		clientId: config.clientId,
		clientSecret: config.clientSecret
	};
};

/**
 * Create and configure a Probot instance.
 * @param config - Probot configuration.
 * @returns Promise<Probot> - A configured Probot instance.
 */
export const createProbot = async (config: ProbotConfig): Promise<Probot> => {
	try {
		// Dynamic import for ESM module compatibility
		const { Probot } = await import('probot');
		const parsedConfig = await parseConfig(config);

		return new Probot({
			...parsedConfig // Spread the parsed configuration properties
		});
	} catch (error) {
		console.error('Error importing probot:', error);
		throw error;
	}
};

/**
 * Create and configure a SmeeClient instance.
 * @param config - Probot configuration.
 * @returns Promise<SmeeClient> - A configured SmeeClient instance.
 */
export const createSmee = async (config: ProbotConfig): Promise<SmeeClient> => {
	const parsedConfig = await parseConfig(config);
	return new SmeeClient({
		source: parsedConfig.webhookProxy as string,
		target: parsedConfig.webhookPath as string,
		logger: console
	});
};

/**
 * Create and configure an Octokit instance for GitHub API requests.
 * @param config - Configuration options for Octokit.
 * @returns Promise<Octokit> - An Octokit instance.
 */
export const createOctokit = async (config: OctokitConfig): Promise<Octokit> => {
	try {
		// Dynamic imports for ESM modules
		const { Octokit } = await import('@octokit/rest');
		const { createAppAuth } = await import('@octokit/auth-app');

		/** Parsed Probot Config */
		const probot = await parseConfig(config.probot);
		/** return an Octokit instance. */
		return new Octokit({
			authStrategy: createAppAuth,
			baseUrl: probot.ghUrl,
			auth: {
				appId: probot.appId,
				privateKey: probot.privateKey,
				clientId: probot.clientId,
				clientSecret: probot.clientSecret,
				...config.auth // Include other auth options if needed
			}
		});
	} catch (error) {
		console.error('Error importing Octokit modules:', error);
		throw error;
	}
};
