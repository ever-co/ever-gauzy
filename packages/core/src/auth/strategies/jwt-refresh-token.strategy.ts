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

	async validate(request: Request, payload: JwtPayload, done: Function) {
		try {
			const { body } = request;
			const refreshToken = body.refresh_token;

			const user = await this.userService.getUserIfRefreshTokenMatches(refreshToken, payload);
			if (!user) {
				return done(new UnauthorizedException('unauthorized'), false);
			} else {
				done(null, user);
			}
		} catch (err) {
			return done(new UnauthorizedException('unauthorized', err.message), false);
		}
	}
}
