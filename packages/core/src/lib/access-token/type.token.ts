import { JwtPayload } from 'jsonwebtoken';
import type { IOAuthAppTokenGrant } from '../auth/oauth-app-scope';
import { createToken } from '../token/shared/create-token';

export const ACCESS_TOKEN_TYPE = 'ACCESS_TOKEN_TYPE';

export const ACCESS_TOKEN = createToken('AccessTokenServiceToken');

export const JWT_ACCESS_TOKEN = createToken('JwtAccessToken');

export interface IAccessTokenMetadata extends JwtPayload {
	/** Client identifier */
	clientId?: string;
	/** User agent */
	userAgent?: string;
	/** IP address */
	ipAddress?: string;
	/** User Id */
	id?: string;
	/** Third-party Id (e.g. from social login) */
	thirdPartyId?: string;
	/** TenantId */
	tenantId?: string;
	/** Organization Id */
	organizationId?: string;
	/** Role */
	role?: string;
	/** Permissions */
	permissions?: string[];
	/**
	 * Set only on a token the OAuth-app code exchange minted: the client the user approved and the scopes they
	 * approved for it. `JwtStrategy` holds the request to those scopes (see `auth/oauth-app-scope.ts`).
	 */
	oauthApp?: IOAuthAppTokenGrant;
	/**
	 * Set only on a token the API token exchange minted: the id of the API token behind it (see
	 * `auth/user-api-token/user-api-token-session.ts`).
	 */
	apiTokenId?: string;
	/**
	 * Set only on a token the embed exchange minted: the credential behind it and the one member it acts for (see
	 * `embed/embed-session.ts`).
	 */
	embedCredentialId?: string;
	embedEmployeeId?: string;
	/**
	 * The page origin an embed token was exchanged for. `EmbedSessionGuard` refuses a request whose `Origin` header names
	 * another one; a request without the header is not checked. A browser names the page's origin on every cross-site
	 * call that carries the token, so the claim keeps another site's page from using it. It does not authenticate where
	 * a request comes from: any other client writes the header it likes, or none.
	 */
	embedOrigin?: string;
	/**
	 * Set only on a token exchanged with a credential limited to a client: that client (an organization contact), as
	 * `embed/embed-session.ts` reads it. A token of a credential of the whole organization does not carry it.
	 */
	embedClientId?: string;
}
