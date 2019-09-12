export interface IFacebookConfig {
  readonly loginDialogUri: string;
  readonly accessTokenUri: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly oauthRedirectUri: string;
  readonly state: string;
}
