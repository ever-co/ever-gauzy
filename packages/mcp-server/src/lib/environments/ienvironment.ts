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
		autoLogin: boolean;
	};
}
