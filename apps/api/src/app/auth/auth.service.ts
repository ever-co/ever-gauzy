import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { User, UserService } from '../user';
import * as bcrypt from 'bcrypt';
import { environment as env, environment } from '@env-api/environment';

import { JsonWebTokenError, sign, verify } from 'jsonwebtoken';
import { UserRegistrationInput as IUserRegistrationInput } from '@gauzy/models';
import { get, post, Response } from 'request';

export enum Provider {
  GOOGLE = 'google',
  FACEBOOK = 'facebook'
}

@Injectable()
export class AuthService {
  saltRounds: number;

  constructor(private readonly userService: UserService) {
    this.saltRounds = env.USER_PASSWORD_BCRYPT_SALT_ROUNDS;
  }

  async getPasswordHash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async login(
    findObj: any,
    password: string
  ): Promise<{ user: User; token: string } | null> {
    const user = await this.userService.findOne(findObj, {
      relations: ['role']
    });

    if (!user || !(await bcrypt.compare(password, user.hash))) {
      return null;
    }

    const token = sign(
      { id: user.id, role: user.role ? user.role.name : '' },
      env.JWT_SECRET,
      {}
    ); // Never expires

    delete user.hash;

    return {
      user,
      token
    };
  }

  async register(input: IUserRegistrationInput): Promise<User> {
    const user = this.userService.create({
      ...input.user,
      ...(input.password
        ? {
            hash: await this.getPasswordHash(input.password)
          }
        : {})
    });

    return user;
  }

  async isAuthenticated(token: string): Promise<boolean> {
    try {
      const { id, thirdPartyId } = verify(token, env.JWT_SECRET) as {
        id: string;
        thirdPartyId: string;
      };

      let result: Promise<boolean>;

      if (thirdPartyId) {
        result = this.userService.checkIfExistsThirdParty(thirdPartyId);
      } else {
        result = this.userService.checkIfExists(id);
      }

      return result;
    } catch (err) {
      if (err instanceof JsonWebTokenError) {
        return false;
      } else {
        throw err;
      }
    }
  }

  async hasRole(token: string, roles: string[] = []): Promise<boolean> {
    try {
      const { id, role } = verify(token, env.JWT_SECRET) as {
        id: string;
        role: string;
      };

      return role ? roles.includes(role) : false;
    } catch (err) {
      if (err instanceof JsonWebTokenError) {
        return false;
      } else {
        throw err;
      }
    }
  }

  async validateOAuthLogin(
    thirdPartyId: string,
    provider: Provider,
    user: User
  ): Promise<{ jwt: string; userId: string }> {
    try {
      const userExist = await this.isUserExist(thirdPartyId);
      if (!userExist) {
        await this.userService.createOne(user);
      }

      const userId = await this.getUserId(thirdPartyId);
      const payload = { thirdPartyId, provider };
      const jwt: string = sign(payload, env.JWT_SECRET, {});

      return { jwt, userId };
    } catch (err) {
      throw new InternalServerErrorException('validateOAuthLogin', err.message);
    }
  }

  private async getUserId(userThirdPartyProviderId: string): Promise<string> {
    const user = await this.userService.findOne({
      thirdPartyId: userThirdPartyProviderId
    });
    const userId = user.id;

    return userId;
  }

  private async isUserExist(
    userThirdPartyProviderId: string
  ): Promise<boolean> {
    const success = await this.userService.checkIfExistsThirdParty(
      userThirdPartyProviderId
    );
    return success;
  }

  async createToken(user: { id: string }): Promise<{ token: string }> {
    const token: string = sign({ id: user.id }, env.JWT_SECRET, {});
    return { token };
  }

  async requestFacebookRedirectUri(): Promise<{ redirectUri: string }> {
    const {
      clientId,
      oauthRedirectUri,
      state,
      loginDialogUri
    } = env.facebookConfig;

    const queryParams: string[] = [
      `client_id=${clientId}`,
      `redirect_uri=${oauthRedirectUri}`,
      `state=${state}`
    ];

    const redirectUri = `${loginDialogUri}?${queryParams.join('&')}`;

    return { redirectUri };
  }

  async facebookSignIn(code: string, responseRedirectUse: any): Promise<any> {
    const {
      clientId,
      oauthRedirectUri,
      clientSecret,
      accessTokenUri
    } = env.facebookConfig;

    const queryParams: string[] = [
      `client_id=${clientId}`,
      `redirect_uri=${oauthRedirectUri}`,
      `client_secret=${clientSecret}`,
      `code=${code}`
    ];

    const uri = `${accessTokenUri}?${queryParams.join('&')}`;
    get(uri, (error: Error, res: Response, body: any) => {
      if (error) {
        console.error(error);
        throw error;
      } else if (body.error) {
        console.error(body.error);
        throw body.error;
      }

      const { access_token } = JSON.parse(body);
      const { host, port } = environment;

      post(
        {
          url: `${host}:${port}/api/auth/facebook/token`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          form: { access_token }
        },
        async (error: Error, res: Response, body: any) => {
          if (error) {
            console.error(error);
            throw error;
          } else if (body.error) {
            console.error(body.error);
            throw body.error;
          }

          const redirectSuccessUrl = body.replace('Found. Redirecting to ', '');
          return responseRedirectUse.redirect(redirectSuccessUrl);
        }
      );
    });
  }
}
