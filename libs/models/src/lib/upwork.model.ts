export interface IAccessTokenDto {
	requestToken: string;
	requestTokenSecret?: string;
	verifier: string;
}

export interface IAccessToken {
	integrationId: string;
	accessToken: string;
	accessTokenSecret: string;
}

export interface IAccessTokenSecretPair {
	integrationId?: string;
	url: string;
	requestToken: string;
	requestTokenSecret?: string;
	accessTokenSecret?: string;
	accessToken?: string;
}
