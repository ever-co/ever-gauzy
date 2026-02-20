import { JwtPayload } from 'jsonwebtoken';
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
}
