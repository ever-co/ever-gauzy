export interface IHubstaffAccessTokens {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
}

export interface ICreateIntegrationDto {
	tenantId: string;
	client_id: string;
	code: string;
	grant_type: string;
	redirect_uri: string;
	client_secret: string;
}

export interface IHubstaffOrganization {
	id: number;
	name: string;
	status: string;
}

export interface IHubstaffProject {
	id: number;
	name: string;
	status: string;
	client_id: number;
}
