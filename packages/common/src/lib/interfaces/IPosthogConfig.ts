/**
 * Represents a configuration object for PostHog server settings.
 */
export interface IPosthogConfig {
	/**
	 * The PostHog API key used to authenticate requests.
	 */
	readonly posthogKey: string;

	/**
	 * The host URL of the PostHog instance (e.g., https://app.posthog.com).
	 */
	readonly posthogHost: string;

	/**
	 * Whether PostHog tracking is enabled.
	 */
	readonly posthogEnabled: boolean;

	/**
	 * How often events are flushed (in milliseconds).
	 */
	readonly posthogFlushInterval: number;
}
