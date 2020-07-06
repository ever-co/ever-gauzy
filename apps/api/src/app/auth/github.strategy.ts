import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { environment as env } from '@env-api/environment';
import { AuthService } from './auth.service';
import { Strategy } from 'passport-github2';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
	constructor(private readonly _authService: AuthService) {
		super({
			clientID: env.githubConfig.clientId,
			clientSecret: env.githubConfig.clientSecret,
			callbackURL: `${env.host}:${env.port}/api/auth/github/callback`,
			passReqToCallback: true,
			scope: ['user:email']
		});
	}
}
