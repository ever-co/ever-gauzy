import { environment } from '@gauzy/config';
import { AnalyticsInterface, JitsuOptions, jitsuAnalytics } from '@jitsu/js';
import fetch from 'node-fetch';
import { JitsuModuleOptions } from './jitsu.types';

/**
 * Parses the options for Jitsu Analytics.
 * @param options The input options object.
 * @returns A record containing parsed Jitsu module options.
 */
export const parseOptions = (options: JitsuModuleOptions): JitsuModuleOptions => ({
	// If the 'isGlobal' property is defined in the input options, use its value; otherwise, default to true.
	isGlobal: options.isGlobal ?? true,

	// Parse the configuration using the 'parseConfig' function and assign the result to the 'config' property.
	config: parseConfig(options.config) //
});

/**
 * Parse the configuration for Jitsu Analytics.
 * @param config The input configuration object.
 * @returns A record containing Jitsu configuration properties.
 */
export const parseConfig = (config: JitsuOptions): Record<string, any> => ({
	host: config.host || environment.jitsu.serverHost || '', // Use serverHost from environment or empty string as default
	writeKey: config.writeKey || environment.jitsu.serverWriteKey || '', // Use serverWriteKey from environment or empty string as default
	debug: config.debug || false, // Use debug from input config or false as default
	echoEvents: config.echoEvents || false // Use echoEvents from input config or false as default
});

/**
 * Create a Jitsu Analytics instance.
 * @param opts The JitsuOptions object for configuration.
 * @returns An instance of Jitsu Analytics.
 */
export const createJitsu = (opts: JitsuOptions): AnalyticsInterface => {
	// Parse the configuration options
	const config = parseConfig(opts);

	if (!config.host || !config.writeKey) {
		return;
	}

	config.fetch = fetch; // Assign the 'fetch' function to 'fetch'

	// Create and return a Jitsu Analytics instance with the parsed configuration properties
	return jitsuAnalytics({
		...config // Spread the parsed configuration properties
	});
};
