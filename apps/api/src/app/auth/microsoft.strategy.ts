import { Injectable } from "@nestjs/common";
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { AuthService } from './auth.service';
import { environment as env } from '@env-api/environment';
import passport from 'passport';

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(Strategy, 'microsoft') {

    constructor(private readonly _authService: AuthService) {
        super({
            clientID: env.microsoftConfig.clientId,
            callbackURL: `${env.host}:${env.port}/api/auth/microsoft/callback`,
            clientSecret: env.microsoftConfig.clientSecret,
            scope: ['profile', 'offline_access'],
            passReqToCallback: true,
            secretOrKey: env.microsoftConfig.jwtSecret,
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()
        });
    }

    async validate(
        request: any,
        accessToken: string,
        refreshToken: string,
        profile,
        done: Function
    ) {
        const role = passport['_strategies'].session.role_name;
        passport['_strategies'].session.role_name = '';
        const { emails, username } = profile;
        try {
            try {
                const {
                    success,
                    authData
                } = await this._authService.validateOAuthLoginEmail(
                    emails
                );

                const user = { success, authData };

                done(null, user);
            } catch (err) {
                done(err, false);
            }
        } catch (err) {
            done(err, false);
        }
    }
}
