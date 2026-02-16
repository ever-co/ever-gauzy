import { JwtPayload } from 'jsonwebtoken';
import { createToken } from '../token/shared/create-token';

export const ACCESS_TOKEN_TYPE = 'ACCESS_TOKEN_TYPE';

export const ACCESS_TOKEN = createToken('AccessTokenServiceToken');

export const JWT_ACCESS_TOKEN = createToken('JwtAccessToken');

export interface IAccessTokenMetadata extends JwtPayload {
	/** Client identify */
	clientId?: string;
	/** User agent */
	userAgent?: string;
	/** IP address */
	ipAddress?: string;
	/** Id */
	id?: string;
	/** Email */
	email?: string;
	/** TenantId */
	tenantId?: string;
	/** Organization Id */
	organizationId?: string;
	/** Role */
	role?: string;
	/** Permissions */
	permissions?: string[];
}
