import { environment as env, environment } from '@env-api/environment';
import {
	UserRegistrationInput as IUserRegistrationInput,
	LanguagesEnum
} from '@gauzy/models';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JsonWebTokenError, sign, verify } from 'jsonwebtoken';
import { get, post, Response } from 'request';
import { EmailService } from '../email/email.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { UserOrganizationService } from '../user-organization/user-organization.services';

export enum Provider {
	GOOGLE = 'google',
	FACEBOOK = 'facebook'
}

@Injectable()
export class AuthService {
	saltRounds: number;

	constructor(
		private readonly userService: UserService,
		private emailService: EmailService,
		private userOrganizationService: UserOrganizationService
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
		const user = await this.userService.findOne(findObj, {
			relations: ['role', 'employee']
		});

		if (!user || !(await bcrypt.compare(password, user.hash))) {
			return null;
		}

		const token = sign(
			{
				id: user.id,
				employeeId: user.employee ? user.employee.id : null,
				role: user.role ? user.role.name : ''
			},
			env.JWT_SECRET,
			{}
		); // Never expires

		delete user.hash;

		return {
			user,
			token
		};
	}

	async requestPassword(
		findObj: any,
		languageCode: LanguagesEnum,
		originUrl?: string
	): Promise<{ id: string; token: string } | null> {
		const user = await this.userService.findOne(findObj, {
			relations: ['role', 'employee']
		});

		let token: string;

		if (user && user.id) {
			const newToken = await this.createToken(user);
			token = newToken.token;

			if (token) {
				const url = `${env.host}:4200/#/auth/reset-password?token=${token}&id=${user.id}`;

				const { orgId } = await this.userOrganizationService.findOne({
					where: {
						user
					}
				});
				this.emailService.requestPassword(
					user,
					url,
					languageCode,
					orgId,
					originUrl
				);

				return {
					id: user.id,
					token
				};
			}
		} else {
			throw new Error('Email not found');
		}
	}

	async resetPassword(findObject) {
		if (findObject.password.length < 6) {
			throw new Error('Password should be at least 6 characters long');
		}

		if (findObject.password !== findObject.confirmPassword) {
			throw new Error('Passwords must match.');
		}

		if (!findObject.user.id) {
			throw new Error('User not found');
		}

		if (!findObject.user.token) {
			throw new Error('Authorization token is invalid or missing');
		}

		const hash = await this.getPasswordHash(findObject.password);
		return this.userService.changePassword(findObject.user.id, hash);
	}
	/**
	 * Shared method involved in
	 * 1. Sign up
	 * 2. Addition of new user to organization
	 * 3. User invite accept scenario
	 */
	async register(
		input: IUserRegistrationInput,
		languageCode: LanguagesEnum
	): Promise<User> {
		let tenant = input.user.tenant;

		if (input.createdById) {
			const creatingUser = await this.userService.findOne(
				input.createdById,
				{
					relations: ['tenant']
				}
			);
			tenant = creatingUser.tenant;
		}

		const user = this.userService.create({
			...input.user,
			tenant,
			...(input.password
				? {
						hash: await this.getPasswordHash(input.password)
				  }
				: {})
		});

		if (input.organizationId) {
			await this.userOrganizationService.addUserToOrganization(
				await user,
				input.organizationId
			);
		}

		this.emailService.welcomeUser(
			input.user,
			languageCode,
			input.organizationId,
			input.originalUrl
		);

		return user;
	}

	async getAuthenticatedUser(
		id: string,
		thirdPartyId?: string
	): Promise<User> {
		return thirdPartyId
			? this.userService.getIfExistsThirdParty(thirdPartyId)
			: this.userService.getIfExists(id);
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
			const { role } = verify(token, env.JWT_SECRET) as {
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

	async validateOAuthLoginEmail(
		emails: Array<{ value: string; verified: boolean }>
	): Promise<{
		success: boolean;
		authData: { jwt: string; userId: string };
	}> {
		let response = {
			success: false,
			authData: { jwt: null, userId: null }
		};

		try {
			for (const { value } of emails) {
				const userExist = await this.userService.checkIfExistsEmail(
					value
				);
				if (userExist) {
					const user = await this.userService.getUserByEmail(value);
					const userId = user.id;
					const userRole = user.role ? user.role.name : '';
					const payload = { id: userId, role: userRole };
					const jwt: string = sign(payload, env.JWT_SECRET, {});
					response = { success: true, authData: { jwt, userId } };
				}
			}
			return response;
		} catch (err) {
			throw new InternalServerErrorException(
				'validateOAuthLoginEmail',
				err.message
			);
		}
	}

	async createToken(user: { id?: string }): Promise<{ token: string }> {
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
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded'
					},
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

					const redirectSuccessUrl = body.replace(
						'Found. Redirecting to ',
						''
					);
					return responseRedirectUse.redirect(redirectSuccessUrl);
				}
			);
		});
	}
}
