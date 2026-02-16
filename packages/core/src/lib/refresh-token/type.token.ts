import { JwtPayload } from 'jsonwebtoken';
import { createToken } from '../token/shared/create-token';

export const REFRESH_TOKEN_TYPE = 'REFRESH_TOKEN_TYPE';

export const REFRESH_TOKEN = createToken('RefreshTokenServiceToken');

export const JWT_REFRESH_TOKEN = createToken('JwtRefreshToken');
export interface IRefreshTokenMetadata extends JwtPayload {
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
}
