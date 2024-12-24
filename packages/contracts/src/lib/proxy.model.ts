export interface ISsl {
	key: string;
	cert: string;
}

export interface ITarget {
	protocol?: string;
	host: string;
	port: string;
	pfx?: string;
	passphrase?: string;
}

export interface IProxyConfig {
	ssl?: ISsl;
	secure?: boolean;
	target?: ITarget;
	enable?: boolean;
}
