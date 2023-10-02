import { CommandBus } from '@nestjs/cqrs';
import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository, SelectQueryBuilder } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as moment from 'moment';
import { JsonWebTokenError, JwtPayload, sign, verify } from 'jsonwebtoken';
import {
	IUserRegistrationInput,
	LanguagesEnum,
	IRolePermission,
	IAuthResponse,
	IUser,
	IChangePasswordRequest,
	IPasswordReset,
	IResetPasswordRequest,
	PermissionsEnum,
	IUserEmailInput,
	IUserSigninWorkspaceResponse,
	IUserCodeInput,
	IUserLoginInput,
	IUserLoginInput as IUserWorkspaceSigninInput,
	IUserTokenInput,
	IOrganizationTeam,
} from '@gauzy/contracts';
import { environment } from '@gauzy/config';
import { SocialAuthService } from '@gauzy/auth';
import { IAppIntegrationConfig, isNotEmpty } from '@gauzy/common';
import { ALPHA_NUMERIC_CODE_LENGTH } from './../constants';
import { EmailService } from './../email-send/email.service';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { RoleService } from './../role/role.service';
import { UserOrganizationService } from '../user-organization/user-organization.services';
import { ImportRecordUpdateOrCreateCommand } from './../export-import/import-record';
import { PasswordResetCreateCommand, PasswordResetGetCommand } from './../password-reset/commands';
import { RequestContext } from './../core/context';
import { freshTimestamp, generateRandomAlphaNumericCode } from './../core/utils';
import { OrganizationTeam, Tenant } from './../core/entities/internal';
import { EmailConfirmationService } from './email-confirmation.service';

@Injectable()
export class AuthService extends SocialAuthService {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,

		@InjectRepository(OrganizationTeam)
		protected readonly organizationTeamRepository: Repository<OrganizationTeam>,

		private readonly emailConfirmationService: EmailConfirmationService,
		private readonly userService: UserService,
		private readonly roleService: RoleService,
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
	async login({ email, password }: IUserLoginInput): Promise<IAuthResponse | null> {
		try {
			const user = await this.userService.findOneByOptions({
				where: {
					email,
					isActive: true,
					isArchived: false,
				},
				relations: {
					employee: true,
					role: true
				},
				order: {
					createdAt: 'DESC'
				}
			});
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
		} catch (error) {
			console.log('Error while authenticating user: %s', error);
			throw new UnauthorizedException();
		}
	}

	/**
	 * Signs in users to workspaces.
	 * @param param0 - IUserSigninWorkspaceInput containing email and password.
	 * @returns IUserSigninWorkspaceResponse containing user details and confirmation status.
	 */
	async signinWorkspacesByEmailPassword({ email, password }: IUserWorkspaceSigninInput): Promise<IUserSigninWorkspaceResponse> {
		console.time('signin workspaces');
		// Fetching users matching the query
		let users = await this.userService.find({
			where: {
				email,
				isActive: true,
			},
			relations: {
				employee: true
			},
			order: {
				createdAt: 'DESC'
			}
		});

		// Filtering users based on password match
		users = users.filter((user: IUser) => !!bcrypt.compareSync(password, user.hash) && (!user.employee || user.employee?.isActive));

		// Creating an array of user objects with relevant data
		const workspaces = users.map((user: IUser) => {
			const payload: JwtPayload = {
				userId: user.id,
				email: user.email,
				tenantId: user.tenant ? user.tenantId : null
			};
			const token = sign(payload, environment.JWT_SECRET, {
				expiresIn: `${environment.JWT_TOKEN_EXPIRATION_TIME}s`
			});
			return new Object({
				user: new User({
					name: user.name,
					imageUrl: user.imageUrl,
					tenant: new Tenant({
						id: user.tenant ? user.tenantId : null,
						name: user.tenant?.name || '',
						logo: user.tenant?.logo || ''
					})
				}),
				token
			});
		});

		// Determining the response based on the number of matching users
		const response: IUserSigninWorkspaceResponse = {
			workspaces,
			confirmed_email: email,
			show_popup: workspaces.length > 1,
			total_workspaces: workspaces.length
		};

		console.timeEnd('signin workspaces');

		if (workspaces.length > 0) {
			return response;
		} else {
			console.log('Error while signin workspace: %s');
			throw new UnauthorizedException();
		}
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
		request: IResetPasswordRequest,
		languageCode: LanguagesEnum,
		originUrl?: string
	): Promise<boolean | BadRequestException> {
		const { email } = request;

		try {
			await this.userRepository.findOneByOrFail({
				email,
				isActive: true
			});
		} catch (error) {
			throw new BadRequestException('Forgot password request failed!');
		}

		try {
			const user = await this.userService.findOneByOptions({
				where: {
					email,
					isActive: true
				},
				relations: {
					role: true,
					employee: true
				}
			});
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

				const { id: userId, tenantId } = user;

				const url = `${environment.clientBaseUrl}/#/auth/reset-password?token=${token}`;
				const { organizationId } = await this.userOrganizationService.findOneByOptions({
					where: {
						userId,
						tenantId
					}
				});
				this.emailService.requestPassword(user, url, languageCode, organizationId, originUrl);
				return true;
			}
		} catch (error) {
			throw new BadRequestException('Forgot password request failed!');
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
				const user = await this.userService.findOneByIdString(id, {
					where: {
						tenantId
					},
					relations: {
						tenant: true
					}
				});
				if (user) {
					const hash = await this.getPasswordHash(password);
					await this.userService.changePassword(user.id, hash);
					return true;
				}
			} catch (error) {
				throw new BadRequestException('Password Reset Failed.');
			}
		} catch (error) {
			throw new BadRequestException('Password Reset Failed.');
		}
	}

	/**
	 * Shared method involved in
	 * 1. Sign up
	 * 2. Addition of new user to organization
	 * 3. User invite accept scenario
	 */
	async register(
		input: IUserRegistrationInput & Partial<IAppIntegrationConfig>,
		languageCode: LanguagesEnum,
	): Promise<User> {
		let tenant = input.user.tenant;
		if (input.createdById) {
			const creatingUser = await this.userService.findOneByIdString(input.createdById, {
				relations: {
					tenant: true
				}
			});
			tenant = creatingUser.tenant;
		}

		/**
		 * Register new user
		 */
		const create = this.userRepository.create({
			...input.user,
			tenant,
			...(input.password
				? {
					hash: await this.getPasswordHash(input.password)
				}
				: {})
		});
		const entity = await this.userRepository.save(create);

		/** Email automatically verified after accept invitation */
		await this.userRepository.update(entity.id, {
			...(input.inviteId
				? {
					emailVerifiedAt: freshTimestamp()
				}
				: {})
		});

		/**
		 * Find latest register user with role
		 */
		const user = await this.userRepository.findOne({
			where: {
				id: entity.id
			},
			relations: {
				role: true
			}
		});

		if (isNotEmpty(input.organizationId)) {
			await this.userOrganizationService.addUserToOrganization(user, input.organizationId);
		}

		//6. Create Import Records while migrating for relative user.
		const { isImporting = false, sourceId = null } = input;
		if (isImporting && sourceId) {
			const { sourceId } = input;
			await this.commandBus.execute(
				new ImportRecordUpdateOrCreateCommand({
					entityType: this.userRepository.metadata.tableName,
					sourceId,
					destinationId: user.id
				})
			);
		}

		/**
		 * Email verification
		 */
		const { appName, appLogo, appSignature, appLink, appEmailConfirmationUrl } = input;
		if (!user.emailVerifiedAt) {
			await this.emailConfirmationService.sendEmailVerification(user, {
				appName,
				appLogo,
				appSignature,
				appLink,
				appEmailConfirmationUrl
			});
		}
		this.emailService.welcomeUser(input.user, languageCode, input.organizationId, input.originalUrl, {
			appName,
			appLogo,
			appSignature,
			appLink
		});
		return user;
	}

	async getAuthenticatedUser(id: string, thirdPartyId?: string): Promise<User> {
		return thirdPartyId ? this.userService.getIfExistsThirdParty(thirdPartyId) : this.userService.getIfExists(id);
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

	/**
	 * Check current user has permission
	 *
	 * @param token
	 * @param roles
	 * @returns
	 */
	async hasPermissions(permissions: PermissionsEnum[] = []): Promise<boolean> {
		try {
			const roleId = RequestContext.currentRoleId();
			return !!(await this.roleService.findOneByIdString(roleId, {
				where: {
					rolePermissions: {
						permission: In(permissions),
						enabled: true
					}
				}
			}));
		} catch (error) {
			return false;
		}
	}

	async validateOAuthLoginEmail(emails: Array<{ value: string; verified: boolean }>): Promise<{
		success: boolean;
		authData: { jwt: string; userId: string };
	}> {
		let response = {
			success: false,
			authData: { jwt: null, userId: null }
		};

		try {
			for (const { value } of emails) {
				const userExist = await this.userService.checkIfExistsEmail(value);
				if (userExist) {
					const user = await this.userService.getOAuthLoginEmail(value);
					const token = await this.getJwtAccessToken(user);

					response = {
						success: true,
						authData: { jwt: token, userId: user.id }
					};
				}
			}
			return response;
		} catch (err) {
			throw new InternalServerErrorException('validateOAuthLoginEmail', err.message);
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
			const user = await this.userService.findOneByIdString(userId, {
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
						.filter((rolePermission: IRolePermission) => rolePermission.enabled)
						.map((rolePermission: IRolePermission) => rolePermission.permission);
				} else {
					payload.permissions = null;
				}
			} else {
				payload.role = null;
			}
			const accessToken = sign(payload, environment.JWT_SECRET, {});
			return accessToken;
		} catch (error) {
			console.log('Error while getting jwt access token', error);
		}
	}

	/**
	 * Get JWT refresh token
	 *
	 * @param user
	 * @returns
	 */
	public async getJwtRefreshToken(user: Partial<IUser>) {
		try {
			const payload: JwtPayload = {
				id: user.id,
				email: user.email,
				tenantId: user.tenantId || null,
				role: user.role ? user.role.name : null
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
			};
		} catch (error) {
			console.log('Error while getting jwt access token from refresh token', error);
		}
	}

	/**
	 *
	 * @param input
	 * @param locale
	 * @returns
	 */
	async sendWorkspaceSigninCode(
		input: IUserEmailInput & Partial<IAppIntegrationConfig>,
		locale: LanguagesEnum
	) {
		const { email } = input;
		if (!email) {
			return;
		}
		try {
			const count = await this.userRepository.countBy({
				email
			});
			if (count === 0) {
				return;
			}

			const code = generateRandomAlphaNumericCode(ALPHA_NUMERIC_CODE_LENGTH);
			const codeExpireAt = moment().add(environment.AUTHENTICATION_CODE_EXPIRATION_TIME, 'seconds').toDate();

			await this.userRepository.update({ email }, { code, codeExpireAt });
			/**
			 * Send password less authentication email
			 */
			let { appName, appLogo, appSignature, appLink, callbackUrl } = input;
			if (callbackUrl) {
				callbackUrl = `${callbackUrl}?email=${email}&code=${code}`;
			}
			this.emailService.passwordLessAuthentication(email, code, locale, {
				appName,
				appLogo,
				appSignature,
				appLink,
				callbackUrl
			});
		} catch (error) {
			console.log('Error while sending authentication code', error?.message);
		}
	}

	/**
	 * Sign in and confirm by code for multi-tenant workspaces.
	 * @param payload - The user invitation code confirmation input.
	 * @returns The user sign-in workspace response.
	 */
	async confirmWorkspaceSigninByCode(
		payload: IUserEmailInput & IUserCodeInput,
		includeTeams: boolean
	): Promise<IUserSigninWorkspaceResponse> {
		try {
			console.time('confirm signin for multi-tenant workspaces');
			const { email, code } = payload;

			// Check for missing email or code
			if (!email || !code) {
				throw new UnauthorizedException();
			}

			// Find users matching the criteria
			let users = await this.userRepository.find({
				where: {
					email,
					code,
					codeExpireAt: MoreThanOrEqual(new Date()),
					isActive: true
				},
				relations: {
					tenant: true,
					employee: true
				}
			});

			const workspaces: IUser[] = [];
			// Create an array of user objects with relevant data
			for await (const user of users) {
				const userId = user.id;
				const tenantId = user.tenant ? user.tenantId : null;
				const employeeId = user.employee ? user.employeeId : null;

				const payload: JwtPayload = {
					userId: user.id,
					email: user.email,
					tenantId: user.tenant ? user.tenantId : null,
					code
				};

				const token = sign(payload, environment.JWT_SECRET, {
					expiresIn: `${environment.JWT_TOKEN_EXPIRATION_TIME}s`
				});

				const workspace = new Object({
					user: new User({
						email: user.email || '',
						name: user.name || '',
						imageUrl: user.imageUrl || '',
						tenant: new Tenant({
							id: user.tenant ? user.tenantId : null,
							name: user.tenant?.name || '',
							logo: user.tenant?.logo || ''
						}),
					}),
					token
				});

				try {
					if (includeTeams) {
						console.time('Get teams for a user within a specific tenant');

						const teams = await this.getTeamsForUser(tenantId, userId, employeeId);
						workspace['current_teams'] = teams;

						console.timeEnd('Get teams for a user within a specific tenant');
					}
				} catch (error) {
					console.log('Error while getting specific teams for specific tenant: %s', error?.message);
				}

				workspaces.push(workspace);
			}

			// Determining the response based on the number of matching users
			const response: IUserSigninWorkspaceResponse = {
				workspaces,
				confirmed_email: email,
				show_popup: workspaces.length > 1,
				total_workspaces: workspaces.length
			};

			console.timeEnd('confirm signin for multi-tenant workspaces');

			// Return the response if there are matching users
			if (workspaces.length > 0) {
				return response;
			} else {
				throw new UnauthorizedException();
			}
		} catch (error) {
			console.log('Error while verifying email & code for multi-tenant workspace signin: %s', error?.message);
			throw new UnauthorizedException();
		}
	}

	/**
	 * Verify workspace signin token
	 *
	 * @param input - The user email and token input.
	 * @returns An object containing user information and tokens.
	 */
	async workspaceSigninVerifyToken(input: IUserEmailInput & IUserTokenInput) {
		try {
			const { email, token } = input;

			// Check for missing email or token
			if (!email || !token) {
				throw new UnauthorizedException();
			}

			let payload: JwtPayload | string = this.verifyToken(token);
			console.log({ payload });

			if (typeof payload === 'object') {
				const { userId, tenantId, code } = payload;
				const user = await this.userRepository.findOneOrFail({
					where: {
						email,
						id: userId,
						tenantId,
						code,
						codeExpireAt: MoreThanOrEqual(new Date()),
						isActive: true
					},
					relations: {
						employee: true,
						role: true
					},
				});

				await this.userRepository.update({
					email,
					id: userId,
					tenantId,
					code,
					isActive: true
				}, {
					code: null,
					codeExpireAt: null
				});

				// If employees are inactive
				if (isNotEmpty(user.employee) && user.employee.isActive === false) {
					throw new UnauthorizedException();
				}

				const access_token = await this.getJwtAccessToken(user);
				const refresh_token = await this.getJwtRefreshToken(user);
				await this.userService.setCurrentRefreshToken(refresh_token, user.id);

				return new Object({
					user,
					token: access_token,
					refresh_token: refresh_token
				});
			}
			throw new UnauthorizedException();
		} catch (error) {
			if (error?.name === 'TokenExpiredError') {
				throw new BadRequestException('JWT token has been expired.');
			}
			console.log('Error while signin workspace for specific tenant: %s', error?.message);
			throw new UnauthorizedException(error?.message);
		}
	}

	/**
	 * Verify the JWT token and return the payload.
	 * @param token - The JWT token to verify.
	 * @returns The token payload or throws an error.
	 */
	private verifyToken(token: string): JwtPayload | string {
		try {
			return verify(token, environment.JWT_SECRET);
		} catch (error) {
			if (error?.name === 'TokenExpiredError') {
				throw new BadRequestException('JWT token has expired.');
			}
			console.log('Error while verifying JWT token: %s', error?.message);
			throw new UnauthorizedException(error?.message);
		}
	}

	/**
	 * Get teams for a user within a specific tenant.
	 *
	 * @param tenantId The ID of the tenant.
	 * @param userId The ID of the user.
	 * @param employeeId The ID of the employee (optional).
	 *
	 * @returns A Promise that resolves to an array of IOrganizationTeam objects.
	 */
	private async getTeamsForUser(
		tenantId: string,
		userId: string,
		employeeId: string | null
	): Promise<IOrganizationTeam[]> {
		const query = this.organizationTeamRepository.createQueryBuilder("organization_team");
		query.innerJoin('organization_team_employee', "team_member", '"team_member"."organizationTeamId" = "organization_team"."id"');

		query.select([
			`"${query.alias}"."id" AS "team_id"`,
			`"${query.alias}"."name" AS "team_name"`,
			`"${query.alias}"."logo" AS "team_logo"`,
			`COALESCE(COUNT("team_member"."id"), 0) AS "team_member_count"`,
			`"${query.alias}"."profile_link" AS "profile_link"`,
			`"${query.alias}"."prefix" AS "prefix"`
		]);

		query.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });

		// Sub Query to get only assigned teams for specific organizations
		const orgSubQuery = (cb: SelectQueryBuilder<OrganizationTeam>): string => {
			const subQuery = cb.subQuery().select('"user_organization"."organizationId"').from("user_organization", "user_organization");
			subQuery.andWhere(`"${subQuery.alias}"."isActive" = true`);
			subQuery.andWhere(`"${subQuery.alias}"."userId" = :userId`, { userId });
			subQuery.andWhere(`"${subQuery.alias}"."tenantId" = :tenantId`, { tenantId });
			return subQuery.distinct(true).getQuery();
		};

		// Sub Query to get only assigned teams for specific organizations
		query.andWhere((cb: SelectQueryBuilder<OrganizationTeam>) => {
			return (`"${query.alias}"."organizationId" IN ` + orgSubQuery(cb));
		});

		// Sub Query to get only assigned teams for a specific employee for specific tenant
		query.andWhere((cb: SelectQueryBuilder<OrganizationTeam>) => {
			const subQuery = cb.subQuery().select('"organization_team_employee"."organizationTeamId"').from("organization_team_employee", "organization_team_employee");
			subQuery.andWhere(`"${subQuery.alias}"."tenantId" = :tenantId`, { tenantId });

			if (isNotEmpty(employeeId)) { subQuery.andWhere(`"${subQuery.alias}"."employeeId" = :employeeId`, { employeeId }); }

			// Sub Query to get only assigned teams for specific organizations
			subQuery.andWhere((cb: SelectQueryBuilder<OrganizationTeam>) => {
				return (`"${subQuery.alias}"."organizationId" IN ` + orgSubQuery(cb));
			});
			return (`"${query.alias}"."id" IN ` + subQuery.distinct(true).getQuery());
		});

		query.addGroupBy(`"${query.alias}"."id"`);
		query.orderBy(`"${query.alias}"."createdAt"`, 'DESC');

		return await query.getRawMany();
	}
}
