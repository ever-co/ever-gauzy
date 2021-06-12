import { environment as env } from '@gauzy/config';
import {
	IUserRegistrationInput,
	LanguagesEnum,
	IRolePermission,
	IAuthResponse
} from '@gauzy/contracts';
import { SocialAuthService } from '@gauzy/auth';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JsonWebTokenError, sign, verify } from 'jsonwebtoken';
import { EmailService } from '../email/email.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { UserOrganizationService } from '../user-organization/user-organization.services';

@Injectable()
export class AuthService extends SocialAuthService {
	constructor(
		private readonly userService: UserService,
		private emailService: EmailService,
		private userOrganizationService: UserOrganizationService
	) {
		super();
	}

	async login(findObj: any, password: string): Promise<IAuthResponse | null> {
		const user = await this.userService.findOne(findObj, {
			relations: ['role', 'role.rolePermissions', 'employee']
		});

		if (!user || !(await bcrypt.compare(password, user.hash))) {
			return null;
		}

		const { token } = await this.createToken(user);
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

		if (user && user.id) {
			const { token } = await this.createToken(user);
			if (token) {
				const url = `${env.host}:4200/#/auth/reset-password?token=${token}&id=${user.id}`;

				const {
					organizationId
				} = await this.userOrganizationService.findOne({
					where: {
						user
					}
				});
				this.emailService.requestPassword(
					user,
					url,
					languageCode,
					organizationId,
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

		const user = await this.userService.create({
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
				user,
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
					const { token } = await this.createToken(user);

					response = {
						success: true,
						authData: { jwt: token, userId: user.id }
					};
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

	async createToken(user: Partial<User>): Promise<{ token: string }> {
		if (!user.role || !user.employee) {
			user = await this.userService.findOne(user.id, {
				relations: ['role', 'role.rolePermissions', 'employee']
			});
		}

		const payload: any = {
			id: user.id,
			tenantId: user.tenantId,
			employeeId: user.employee ? user.employee.id : null
		};

		if (user.role) {
			payload.role = user.role.name;
			if (user.role.rolePermissions) {
				payload.permissions = user.role.rolePermissions
					.filter(
						(rolePermission: IRolePermission) =>
							rolePermission.enabled
					)
					.map(
						(rolePermission: IRolePermission) =>
							rolePermission.permission
					);
			} else {
				payload.permissions = null;
			}
		} else {
			payload.role = null;
		}

		const token: string = sign(payload, env.JWT_SECRET, {});
		return { token };
	}
}
