export interface ISMTPConfig {
	host: string;
	port: number;
	secure: boolean;
	auth?: {
		user: string;
		pass: string;
	};
	from?: string;
}
