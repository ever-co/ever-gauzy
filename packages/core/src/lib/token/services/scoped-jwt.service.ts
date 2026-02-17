import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { IJwtService, ITokenPayload } from '../interfaces';

/**
 * Scoped JWT Service
 * Allows each token type to have its own JWT secret
 */
@Injectable()
export class ScopedJwtService implements IJwtService {
	constructor(private readonly secret: string, private readonly tokenType: string) {}

	sign(payload: ITokenPayload, expiresIn?: number): string {
		const options: jwt.SignOptions = {};

		if (expiresIn) {
			options.expiresIn = expiresIn;
		}

		return jwt.sign(payload, this.secret, options);
	}

	async verify(token: string): Promise<ITokenPayload> {
		let decoded: ITokenPayload;
		try {
			decoded = jwt.verify(token, this.secret) as ITokenPayload;
		} catch (error) {
			if (error instanceof jwt.TokenExpiredError) {
				throw new Error('Token has expired');
			}
			if (error instanceof jwt.JsonWebTokenError) {
				throw new Error('Invalid token');
			}
			throw new Error('Token verification failed');
		}

		// Verify token type matches (outside try/catch so application errors are not swallowed)
		if (decoded.tokenType !== this.tokenType) {
			throw new Error('Token type mismatch');
		}

		return decoded;
	}

	decode(token: string): ITokenPayload | null {
		try {
			const decoded = jwt.decode(token) as ITokenPayload;
			return decoded;
		} catch (error) {
			console.error('Failed to decode token:', error);
			return null;
		}
	}

	hashToken(token: string): string {
		return crypto.createHash('sha256').update(token).digest('hex');
	}
}
