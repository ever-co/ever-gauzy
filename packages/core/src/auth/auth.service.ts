import { environment } from '@gauzy/config';
import {
	IUserRegistrationInput,
	LanguagesEnum,
	IRolePermission,
	IAuthResponse,
	IUser,
	IChangePasswordRequest,
	IPasswordReset
} from '@gauzy/contracts';
import { CommandBus } from '@nestjs/cqrs';
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SocialAuthService } from '@gauzy/auth';
import { isNotEmpty } from '@gauzy/common';
import * as bcrypt from 'bcrypt';
import { JsonWebTokenError, JwtPayload, sign, verify } from 'jsonwebtoken';
import { EmailService } from '../email/email.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { UserOrganizationService } from '../user-organization/user-organization.services';
import { ImportRecordUpdateOrCreateCommand } from './../export-import/import-record';
import { PasswordResetCreateCommand, PasswordResetGetCommand } from './../password-reset/commands';
import { RequestContext } from './../core/context';

@Injectable()
export class AuthService extends SocialAuthService {
	constructor(
		private readonly userService: UserService,
		private readonly emailService: EmailService,
		private readonly userOrganizationService: UserOrganizationService,
		private readonly commandBus: CommandBus,
		private readonly dataSource: DataSource
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
		const user = await this.userService.findOneByOptions({
			where: {
				email
			},
			relations: {
				employee: true,
				role: {
					rolePermissions: true
				}
			},
			relationLoadStrategy: 'query',
			order: {
				createdAt: 'DESC'
			}
		});

		if (!user || user.isActive === false) {
			throw new UnauthorizedException();
		}
		// If employees are inactive
		if (isNotEmpty(user.employee) && user.employee.isActive === false) {
			throw new UnauthorizedException();
		}
		// If password is not matching with any user
		if (!(await bcrypt.compare(password, user.hash))) {
			throw new UnauthorizedException();
		}

		const access_token = await this.getJwtAccessToken(user);
		const refresh_token = await this.getJwtRefreshToken(user);

		await this.userService.setCurrentRefreshToken(refresh_token, user.id);
		return {
			user,
			token: access_token,
			refresh_token: refresh_token
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
			const user = await this.userService.findOneByOptions({
				where: {
					...request
				},
				relations: {
					role: true,
					employee: true
				}
			});
			try {
				/**
				 * Create password reset request
				 */
				const token = await this.getJwtAccessToken(user);
				if (token) {
					await this.commandBus.execute(
						new PasswordResetCreateCommand({
							email: user.email,
							token
						})
					);

					const { id: userId } = user;

					const url = `${environment.clientBaseUrl}/#/auth/reset-password?token=${token}`;
					const { organizationId } = await this.userOrganizationService.findOneByOptions({
						where: {
							userId
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
						relations: {
							tenant: true
						}
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
					relations: {
						tenant: true
					}
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
					entityType: this.dataSource.getRepository(User).metadata.tableName,
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
				relations: {
					role: true
				}
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
					const token = await this.getJwtAccessToken(user);

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
	 * Get JWT access token
	 *
	 * @param payload
	 * @returns
	 */
	public async getJwtAccessToken(request: Partial<IUser>) {
		try {
			const userId = request.id;
			const user =  await this.userService.findOneByIdString(userId, {
				relations: {
					employee: true,
					role: {
						rolePermissions: true
					}
				},
				order: {
					createdAt: 'DESC'
				}
			});
			const payload: JwtPayload = {
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
			const accessToken = sign(payload, environment.JWT_SECRET, {})
        	return accessToken;
		} catch (error) {
			console.log('Error while getting jwt access token', error);
		}
    }

	/**
	 * Get JWT refresh token
	 *
	 * @param payload
	 * @returns
	 */
	public async getJwtRefreshToken(user: Partial<IUser>) {
		try {
			const payload: JwtPayload = {
				id: user.id,
				email: user.email,
				tenantId: (user.tenantId) || null,
				role: (user.role) ? (user.role.name) : null
			};
			const refreshToken = sign(payload, environment.JWT_REFRESH_TOKEN_SECRET, {
				expiresIn: `${environment.JWT_REFRESH_TOKEN_EXPIRATION_TIME}s`
			});
			return refreshToken;
		} catch (error) {
			console.log('Error while getting jwt refresh token', error);
		}
    }

	/**
	 * Get JWT access token from JWT refresh token
	 *
	 * @returns
	 */
	async getAccessTokenFromRefreshToken() {
		try {
			const user = RequestContext.currentUser();
			return {
				token: await this.getJwtAccessToken(user)
			}
		} catch (error) {
			console.log('Error while getting jwt access token from refresh token', error);
		}
	}
}
