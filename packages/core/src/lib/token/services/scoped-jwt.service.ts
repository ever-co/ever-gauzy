import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JsonWebTokenError, JwtService, JwtSignOptions, TokenExpiredError } from '@nestjs/jwt';
import { IJwtService, ITokenPayload } from '../interfaces';

/**
 * Scoped JWT Service
 * Allows each token type to have its own JWT secret
 */
@Injectable()
export class ScopedJwtService implements IJwtService {
	constructor(
		private readonly secret: string,
		private readonly tokenType: string,
		private readonly jwtService: JwtService
	) {}

	public async sign(payload: ITokenPayload, expiresIn?: number): Promise<string> {
		const options: JwtSignOptions = {
			secret: this.secret
		};

		if (expiresIn) {
			options.expiresIn = expiresIn;
		}

		return this.jwtService.signAsync(payload, options);
	}

	async verify(token: string): Promise<ITokenPayload> {
		let decoded: ITokenPayload;
		try {
			decoded = (await this.jwtService.verifyAsync(token, { secret: this.secret })) as ITokenPayload;
		} catch (error) {
			if (error instanceof TokenExpiredError) {
				throw new UnauthorizedException('Token has expired');
			}
			if (error instanceof JsonWebTokenError) {
				throw new UnauthorizedException('Invalid token');
			}
			throw new UnauthorizedException('Token verification failed');
		}

		// Verify token type matches (outside try/catch so application errors are not swallowed)
		if (decoded.tokenType !== this.tokenType) {
			throw new UnauthorizedException('Token type mismatch');
		}

		return decoded;
	}

	decode(token: string): ITokenPayload | null {
		try {
			const decoded = this.jwtService.decode(token) as ITokenPayload;
			return decoded;
		} catch (error) {
			console.error('Failed to decode token:', error);
			return null;
		}
	}
}
