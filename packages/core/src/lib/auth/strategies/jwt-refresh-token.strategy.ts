import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from 'jsonwebtoken';
import { Request } from 'express';
import { environment } from '@gauzy/config';
import { UserService } from './../../user/user.service';

@Injectable()
export class JwtRefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh-token') {
	constructor(
		private readonly userService: UserService
	) {
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
	async validate(
		request: Request,
		payload: JwtPayload,
		done: Function
	): Promise<void> {
		try {
			const { refresh_token } = request.body; // Extract the refresh token

			// Validate the user using the refresh token and JWT payload
			const user = await this.userService.getUserIfRefreshTokenMatches(refresh_token, payload);

			if (!user) {
				return done(new UnauthorizedException('Unauthorized'), false); // Return unauthorized if validation fails
			}

			done(null, user); // Return user if validation is successful
		} catch (err) {
			// Handle errors and provide a meaningful response
			return done(new UnauthorizedException('Unauthorized', err.message), false);
		}
	}
}
