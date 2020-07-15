import { environment as env } from '@env-api/environment';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-auth0';
import { AuthService } from './auth.service';

@Injectable()
export class Auth0Strategy extends PassportStrategy(Strategy, 'auth0') {
	constructor(private readonly _authService: AuthService) {
		super({
			clientID: env.auth0Config.clientID || 'disabled',
			clientSecret: env.auth0Config.clientSecret || 'disabled',
			domain: env.auth0Config.domain || 'disabled',
			callbackURL: `${env.host}:${env.port}/api/auth/auth0/callback`
		});
	}
}
