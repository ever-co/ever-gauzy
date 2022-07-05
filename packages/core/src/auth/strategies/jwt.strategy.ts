import { environment as env } from '@gauzy/config';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from 'jsonwebtoken';
import { IUser } from '@gauzy/contracts';
import { AuthService } from './../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {

	constructor(
		private readonly authService: AuthService
	) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			secretOrKey: env.JWT_SECRET
		});
	}

	async validate(payload: JwtPayload, done: Function) {
		try {
			const { id, thirdPartyId } = payload;
			// We use this to also attach the user object to the request context.
			const user: IUser = await this.authService.getAuthenticatedUser(
				id,
				thirdPartyId
			);
			if (!user) {
				return done(new UnauthorizedException('unauthorized'), false);
			} else {
				user.employeeId = payload.employeeId;

				// You could add a function to the authService to verify the claims of the token:
				// i.e. does the user still have the roles that are claimed by the token
				// const validClaims = await this.authService.verifyTokenClaims(payload);

				// if (!validClaims)
				//    return done(new UnauthorizedException('invalid token claims'), false);

				done(null, user);
			}
		} catch (err) {
			console.error(err);
			return done(
				new UnauthorizedException('unauthorized', err.message),
				false
			);
		}
	}
}
