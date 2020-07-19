import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { environment as env } from '@env-api/environment';
import { Strategy } from 'passport-azure-ad-oauth2';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {
	constructor(private readonly _authService: AuthService) {
		super({
			clientID: env.microsoftConfig.clientId || 'disabled',
			clientSecret: env.microsoftConfig.clientSecret || 'disabled',
			resource: env.microsoftConfig.resource || 'disabled',
			tenant: env.microsoftConfig.tenant || 'disabled',
			useCommonEndpoint: false,
			callbackURL: `${env.host}:${env.port}/api/auth/microsoft/callback`
		});
	}
}
