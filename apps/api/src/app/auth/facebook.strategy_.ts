import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook-token-nest';
// import { Strategy } from 'passport-facebook-token';


@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor() {
    super({
      clientID: '742744756159529',
      clientSecret: 'a52976ad471c2378c151e5383635d473',
      callbackURL: 'http://localhost:3000/api/auth/facebook/callback',
      passReqToCallback: true,
      // scope: ['profile'],
      profileFields: ['id', 'displayName', 'emails', 'photos']
    });
  }

  async validate(
    request: any,
    accessToken: string,
    refreshToken: string,
    profile,
    done: Function
  ) {
    console.log('PROFILE');
    console.log(profile);
    done(null, {});
  }
}
