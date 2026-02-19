import { environment } from '@gauzy/config';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RefreshTokenService } from '../../refresh-token/refresh-token.service';
import { UserService } from './../../user/user.service';

@Injectable()
export class JwtRefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh-token') {
	constructor(private readonly userService: UserService, private readonly refreshTokenService: RefreshTokenService) {
		super({
			jwtFromRequest: ExtractJwt.fromBodyField('refresh_token'),
			secretOrKey: environment.JWT_REFRESH_TOKEN_SECRET,
			passReqToCallback: true,
			ignoreExpiration: false
		});
	}

	/**
	 * Validates the refresh token and payload to ensure user authorization.
	 *
	 * @param request - The incoming request, expected to contain the refresh token in its body.
	 * @param payload - The JWT payload to validate.
	 * @param done - The callback function to be called upon validation completion.
	 */
	async validate(request: Request, payload: JwtPayload, done: (err: unknown, user?: unknown) => void): Promise<void> {
		try {
			const { refresh_token } = request.body; // Extract the refresh token

			const { isValid, token, reason } = await this.refreshTokenService.verify(refresh_token); // Validate the refresh token against the service

			if (!isValid) {
				return done(new UnauthorizedException(reason ?? 'Unauthorized'), false); // Return unauthorized if validation fails
			}

			const verifiedUserId = token?.userId;
			const payloadUserId =
				(typeof payload?.['userId'] === 'string' && payload['userId']) ||
				(typeof payload?.['id'] === 'string' && payload['id']) ||
				(typeof payload?.sub === 'string' && payload.sub) ||
				null;

			// Defense in depth: make sure the JWT identity resolved by passport matches
			// the identity resolved by the token validation path.
			if (!verifiedUserId || (payloadUserId && payloadUserId !== verifiedUserId)) {
				return done(new UnauthorizedException('Unauthorized'), false);
			}

			const user = await this.userService.findOneByIdString(verifiedUserId); // Fetch the user based on the payload ID

			if (!user) {
				return done(new UnauthorizedException('Unauthorized'), false); // Return unauthorized if validation fails
			}

			done(null, user); // Return user if validation is successful
		} catch (err) {
			// Handle errors and provide a meaningful response
			const message = err instanceof Error ? err.message : String(err);
			return done(new UnauthorizedException('Unauthorized', message), false);
		}
	}
}
