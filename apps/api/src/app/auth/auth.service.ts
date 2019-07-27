
import { Injectable, Provider, InternalServerErrorException } from '@nestjs/common';
import { User, UserService } from '../user';
import * as bcrypt from 'bcrypt';
import { environment as env } from '@env-api/environment'

// have to combine the two imports
import * as jwt from 'jsonwebtoken';
import { JsonWebTokenError, sign } from 'jsonwebtoken';
import { UserRegistrationInput as IUserRegistrationInput } from '@gauzy/models';

@Injectable()
export class AuthService {
	saltRounds: number;
	private readonly JWT_SECRET_KEY = '+RudOJ3WWsw/+g0DZNkjvHjoNUJGXUlpJ7iRjKFZ7zRoFJsrMqiBB5FGyj14GqG1acUm3lr0mVfkkzQqD89zSYzZLTh+atvQ6UcGKZShqSFFLkYqqpR0s+4UG2QawsDqaB81I9mkJkGJallAQ/odkxKGcBpV3qSQPBrupE4UhtrCDsRi3yu+jiBkmyBC9uJCB2/qw8iaKttKxhv9Y/YW98hY7ewrE5Pr1pkg7OJOe3NdEr8/Y4az0g4Pj/pqp33vR1uMAoAt33vciKtSgg9OdX5SgP5PAh6IDfJkfT2622NjVQwUXmSI0gVdETiYR1YLzfe45jm+HPkeP37Q/RSj+Q=='

	constructor(
		private readonly userService: UserService,
	) {
		this.saltRounds = env.USER_PASSWORD_BCRYPT_SALT_ROUNDS;
	}

	async getPasswordHash(password: string): Promise<string> {
		return bcrypt.hash(password, this.saltRounds);
	}

	async login(
		findObj: any,
		password: string
	): Promise<{ user: User; token: string } | null> {
		const user = await this.userService.findOne(findObj, { relations: ['role'] })

		if (!user || !(await bcrypt.compare(password, user.hash))) {
			return null;
		}

		const token = jwt.sign(
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
					hash: await this.getPasswordHash(
						input.password
					)
				}
				: {})
		});

		return user;
	}

	async isAuthenticated(token: string): Promise<boolean> {
		try {
			const { id } = jwt.verify(token, env.JWT_SECRET) as {
				id: string;
			};

			return this.userService.checkIfExists(id);
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
			const { id, role } = jwt.verify(token, env.JWT_SECRET) as {
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

	async validateOAuthLogin(thirdPartyId: string, provider: Provider): Promise<string>
    {
        try 
        {
            // You can add some registration logic here, 
            // to register the user using their thirdPartyId (in this case their googleId)
            // let user: IUser = await this.usersService.findOneByThirdPartyId(thirdPartyId, provider);
            
            // if (!user)
				// user = await this.usersService.registerOAuthUser(thirdPartyId, provider);
				console.log(thirdPartyId);
				
				//await this.userService.register(thirdPartyId, provider);
            const payload = {
                thirdPartyId,
                provider
            }

            const jwt: string = sign(payload, this.JWT_SECRET_KEY, { expiresIn: 3600 });
            return jwt;
        }
        catch (err)
        {
            throw new InternalServerErrorException('validateOAuthLogin', err.message);
        }
    }

}
