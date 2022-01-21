import { environment } from '@gauzy/config';
import {
	IUserRegistrationInput,
	LanguagesEnum,
	IRolePermission,
	IAuthResponse,
	IUser,
	IChangePasswordRequest
} from '@gauzy/contracts';
import { CommandBus } from '@nestjs/cqrs';
import { getManager } from 'typeorm';
import { SocialAuthService } from '@gauzy/auth';
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JsonWebTokenError, sign, verify } from 'jsonwebtoken';
import { EmailService } from '../email/email.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { UserOrganizationService } from '../user-organization/user-organization.services';
import { ImportRecordUpdateOrCreateCommand } from './../export-import/import-record';
import { PasswordResetCreateCommand, PasswordResetGetCommand } from './../password-reset/commands';
import { IPasswordReset } from '@gauzy/contracts';
import { RequestContext } from 'core';

@Injectable()
export class AuthService extends SocialAuthService {
	constructor(
		private readonly userService: UserService,
		private readonly emailService: EmailService,
		private readonly userOrganizationService: UserOrganizationService,
		private readonly commandBus: CommandBus
	) {
		super();
	}

	/**
	 * User Login Request
	 * 
	 * @param email 
	 * @param password 
	 * @returns 
	 */
	async login(email: string, password: string): Promise<IAuthResponse | null> {
		const user = await this.userService.findOneByConditions({ email }, {
			relations: ['role', 'role.rolePermissions', 'employee'],
			order: {
				createdAt: 'DESC'
			}
		});
		if (!user || !(await bcrypt.compare(password, user.hash))) {
			return null;
		}
		const { token } = await this.createToken(user);
		return {
			user,
			token
		};
	}

	/**
	 * Request Reset Password
	 * 
	 * @param request 
	 * @param languageCode 
	 * @param originUrl 
	 * @returns 
	 */
	async requestPassword(
		request: any,
		languageCode: LanguagesEnum,
		originUrl?: string
	): Promise<{ token: string } | null> {
		try {
			const user = await this.userService.findOneByConditions(request, {
				relations: ['role', 'employee']
			});
			try {
				/**
				 * Create password reset request
				 */
				const { token } = await this.createToken(user);
				if (token) {
					await this.commandBus.execute(
						new PasswordResetCreateCommand({
							email: user.email,
							token
						})
					);

					const url = `${environment.clientBaseUrl}/#/auth/reset-password?token=${token}`;
					const { organizationId } = await this.userOrganizationService.findOneByOptions({
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
						token
					};
				}
			} catch (error) {
				console.log(error);
				throw new InternalServerErrorException();
			}
		} catch (error) {
			console.log(error);
			throw new NotFoundException('Email is not correct, please try again.');
		}
	}

	/**
	 * Change password
	 * 
	 * @param request 
	 */
	async resetPassword(request: IChangePasswordRequest) {
		try {
			const { password, token } = request;
			const record: IPasswordReset = await this.commandBus.execute(
				new PasswordResetGetCommand({
					token
				})
			);
			if (record.expired) {
				throw new BadRequestException('Password Reset Failed.');
			}
			const { id, tenantId } = verify(token, environment.JWT_SECRET) as {
				id: string;
				tenantId: string;
			};
			try {
				const user = await this.userService.findOneByIdString(
					id,
					{
						where: {
							tenantId
						},
						relations: ['tenant']
					}
				);
				if (user) {
					const hash = await this.getPasswordHash(password);
					await this.userService.changePassword(user.id, hash);
					return true;
				}
			} catch (error) {
				throw new BadRequestException('Password Reset Failed.')
			}
		} catch (error) {
			throw new BadRequestException('Password Reset Failed.')
		}
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
			const creatingUser = await this.userService.findOneByIdString(
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

		//6. Create Import Records while migrating for relative user.
		const { isImporting = false, sourceId = null } = input;
		if (isImporting && sourceId) {
			const { sourceId } = input;
			await this.commandBus.execute(
				new ImportRecordUpdateOrCreateCommand({
					entityType: getManager().getRepository(User).metadata.tableName,
					sourceId,
					destinationId: user.id
				})
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
			const { id, thirdPartyId } = verify(token, environment.JWT_SECRET) as {
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

	/**
	 * Check current user has role
	 * 
	 * @param token 
	 * @param roles 
	 * @returns 
	 */
	 async hasRole(roles: string[] = []): Promise<boolean> {
		try {
			const { role } = await this.userService.findOneByIdString(RequestContext.currentUserId(), {
				relations: ['role']
			});
			return role ? roles.includes(role.name) : false;
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

	/**
	 * Create random token
	 * 
	 * @param user 
	 * @returns 
	 */
	async createToken(user: Partial<IUser>): Promise<{ token: string }> {
		if (!user.role || !user.employee) {
			user = await this.userService.findOneByIdString(user.id, {
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
		const token: string = sign(payload, environment.JWT_SECRET, {});
		return { token };
	}
}
