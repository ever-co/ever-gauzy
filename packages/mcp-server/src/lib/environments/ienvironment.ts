export interface IEnvironment {
	production: boolean;
	envName: string;
	mcpAppName: string;
	appId: string;
	baseUrl: string;
	apiTimeout: number;
	debug: boolean;
	nodeEnv: string;
	// Authentication credentials
	auth: {
		email?: string;
		password?: string;
		/** GAUZY_API_TOKEN, a personal API token: when set, the server signs in with it instead of the email and password */
		apiToken?: string;
		/** On with GAUZY_AUTO_LOGIN, or with an API token */
		autoLogin: boolean;
	};
}
