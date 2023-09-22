export interface IGithubConfig extends Partial<IGithubIntegrationConfig> {
	/** */
	readonly CLIENT_ID: string;
	readonly CLIENT_SECRET: string;
	readonly CALLBACK_URL: string;
}

export interface IGithubIntegrationConfig {
	/** */
	readonly APP_ID: string;
	readonly APP_NAME: string;
	readonly APP_PRIVATE_KEY: string;

	/** */
	readonly POST_INSTALL_URL: string;

	/** */
	readonly WEBHOOK_URL: string;
	readonly WEBHOOK_SECRET: string;
}
