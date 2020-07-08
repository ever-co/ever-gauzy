import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt } from 'passport-jwt';
import { AuthService } from './auth.service';
import { environment as env } from '@env-api/environment';
import { Strategy } from 'passport-twitter';

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, 'twitter') {
	constructor(private readonly _authService: AuthService) {
		super({
			consumerKey: env.twitterConfig.clientId || 'disabled',
			consumerSecret: env.twitterConfig.clientSecret || 'disabled',
			callbackURL: `${env.host}:${env.port}/api/auth/twitter/callback`,
			passReqToCallback: true,
			includeEmail: true,
			secretOrKey: env.JWT_SECRET,
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
		});
	}
}
