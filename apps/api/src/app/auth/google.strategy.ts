import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { AuthService, Provider } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly _authService: AuthService) {
    super({
      clientID:
        '1061129983046-pt4tnjteh9h1phfqapqkkea03iq0s351.apps.googleusercontent.com',
      clientSecret: 'liU5ihpwoqnsmXJNxNjFp1yP',
      callbackURL: 'http://localhost:3000/api/auth/google/callback',
      passReqToCallback: true,
      scope: ['profile']
    });
  }

  async validate(
    request: any,
    accessToken: string,
    refreshToken: string,
    profile,
    done: Function
  ) {
    try {
      console.log(profile);

      const jwt: string = await this._authService.validateOAuthLogin(
        profile.id,
        Provider.GOOGLE
      );
      const user = {
        jwt
      };

      done(null, user);
    } catch (err) {
      console.error(err);
      done(err, false);
    }
  }
}
