import { Injectable } from '@nestjs/common';
import { use } from 'passport';
import { environment as env } from '@env-api/environment';
import { Provider, AuthService } from './auth.service';
import { RoleService } from '../role/role.service';
import { User, RolesEnum } from '@gauzy/models';

const FacebookTokenStrategy = require('passport-facebook-token');

@Injectable()
export class FacebookStrategy {
  constructor(
    private readonly _authService: AuthService,
    private readonly _roleService: RoleService
  ) {
    this.init();
  }

  private init(): void {
    const { clientId, clientSecret } = env.facebookConfig;
    use(
      'facebook',
      new FacebookTokenStrategy(
        {
          clientID: clientId,
          clientSecret: clientSecret
        },
        async (
          accessToken: string,
          refreshToken: string,
          profile: any,
          done: Function
        ) => {
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
              Provider.FACEBOOK,
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
      )
    );
  }
}
