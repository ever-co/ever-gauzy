import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { AuthService, Provider } from './auth.service';
import { User } from '../user';
import { RoleService } from '../role';
import { RolesEnum } from '@gauzy/models';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly _authService: AuthService,
    private readonly _roleService: RoleService
  ) {
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
    const { id, displayName, name, photos } = profile;
    const { givenName, familyName } = name;
    const imageUrl = photos[0].value;

    // Get user default role
    const employeeRole = await this._roleService.findOne({
      name: RolesEnum.EMPLOYEE
    });

    const newUser: User = {
      firstName: givenName,
      lastName: familyName,
      imageUrl: imageUrl,
      thirdPartyId: id,
      role: employeeRole,
      username: displayName
    };

    try {
      const { jwt, userId } = await this._authService.validateOAuthLogin(
        id,
        Provider.GOOGLE,
        newUser
      );

      const user = {
        jwt,
        userId
      };

      done(null, user);
    } catch (err) {
      done(err, false);
    }
  }
}
