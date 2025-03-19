// see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Helper function to check if a feature is enabled
 *
 * @param featureKey - The feature key to check
 * @param defaultEnable - Default value to return if the feature is not enabled
 * @returns
 */
export const isFeatureEnabled = (featureKey: string): boolean => {
	return process.env[featureKey] !== 'false';
};
