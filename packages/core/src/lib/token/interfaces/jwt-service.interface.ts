import { ITokenPayload } from './token.interface';

export interface IJwtService {
	/**
	 * Sign a JWT token with the given payload
	 */
	sign(payload: ITokenPayload, expiresIn?: string | number): string;

	/**
	 * Verify and decode a JWT token
	 */
	verify(token: string): Promise<ITokenPayload>;

	/**
	 * Decode a JWT token without verification (for debugging)
	 */
	decode(token: string): ITokenPayload | null;

	/**
	 * Hash a token for storage (one-way hash)
	 */
	hashToken(token: string): string;
}
