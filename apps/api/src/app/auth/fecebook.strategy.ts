import { Injectable } from '@nestjs/common';
import { use } from 'passport';
import * as FacebookTokenStrategy from 'passport-facebook-token';

@Injectable()
export class FacebookStrategy {
  constructor() {
    this.init();
  }

  private init(): void {
    use(
      'facebook',
      new FacebookTokenStrategy(
        {
          clientID: '368093470753138',
          clientSecret: '82b1629c96502b1d5d9ccca9dabe2900'
        },
        async (
          accessToken: string,
          refreshToken: string,
          profile: any,
          done
        ) => {
          console.log('PROFILE');
          console.log(profile);
          done(null, null);
        }
      )
    );
  }
}
