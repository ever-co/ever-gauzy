import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { IJwtService } from '../interfaces/jwt-service.interface';
import { ITokenPayload } from '../interfaces/token.interface';

@Injectable()
export class JwtService implements IJwtService {
	private readonly secret: string;

	constructor(private readonly configService: ConfigService) {
		this.secret = this.configService.get<string>('JWT_SECRET');

		if (!this.secret) {
			throw new Error('JWT_SECRET is not defined in the environment variables');
		}
	}

	public sign(payload: ITokenPayload, expiresIn?: number): string {
		const options: jwt.SignOptions = {};

		if (expiresIn) {
			options.expiresIn = expiresIn;
		}

		return jwt.sign(payload, this.secret, options);
	}

	public async verify(token: string): Promise<ITokenPayload> {
		try {
			const decoded = jwt.verify(token, this.secret) as ITokenPayload;

			return decoded;
		} catch (error) {
			if (error instanceof jwt.TokenExpiredError) {
				throw new UnauthorizedException('Token has expired');
			}
			if (error instanceof jwt.JsonWebTokenError) {
				throw new UnauthorizedException('Invalid token');
			}
			throw new UnauthorizedException('Token verification failed');
		}
	}

	public decode(token: string): ITokenPayload | null {
		try {
			const decoded = jwt.decode(token) as ITokenPayload;
			return decoded;
		} catch (error) {
			console.error('Failed to decode token:', error);
			return null;
		}
	}
}
