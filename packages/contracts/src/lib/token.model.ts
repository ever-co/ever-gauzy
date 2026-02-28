export interface ITokenPair {
	/** Refresh Token */
	refresh_token: string;
	/** Access Token */
	token: string;
}

export interface RefreshRequest extends ITokenPair {
	/** Client identify */
	clientId?: string;
}
