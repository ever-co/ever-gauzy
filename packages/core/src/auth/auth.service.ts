import { CommandBus } from '@nestjs/cqrs';
import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository, SelectQueryBuilder } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as moment from 'moment';
import { JsonWebTokenError, JwtPayload, sign, verify } from 'jsonwebtoken';
import { pick } from 'underscore';
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
	IWorkspaceResponse,
	ITenant,
} from '@gauzy/contracts';
import { environment } from '@gauzy/config';
import { SocialAuthService } from '@gauzy/auth';
import { IAppIntegrationConfig, MikroInjectRepository, deepMerge, isNotEmpty } from '@gauzy/common';
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
import { EntityRepository } from '@mikro-orm/core';
import { prepareSQLQuery as p } from './../database/database.helper';

@Injectable()
export class AuthService extends SocialAuthService {
	constructor(
		@InjectRepository(User)
		private readonly userRepository: Repository<User>,
		@MikroInjectRepository(User)
		private readonly mikroUserRepository: EntityRepository<User>,

		@InjectRepository(OrganizationTeam)
		protected readonly organizationTeamRepository: Repository<OrganizationTeam>,

		@MikroInjectRepository(OrganizationTeam)
		protected readonly mikroOrganizationTeamRepository: EntityRepository<OrganizationTeam>,

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
			console.log(error);
			throw new UnauthorizedException();
		}
	}

	/**
	 * Authenticate a user by email and password and return user workspaces.
	 *
	 * @param email - The user's email.
	 * @param password - The user's password.
	 * @returns A promise that resolves to a response with user workspaces.
	 * @throws UnauthorizedException if authentication fails.
	 */
	async signinWorkspacesByEmailPassword({ email, password }: IUserWorkspaceSigninInput): Promise<IUserSigninWorkspaceResponse> {

		/** Fetching users matching the query */
		let users = await this.userService.find({
			where: {
				email,
				isActive: true,
				isArchived: false
			},
			relations: {
				tenant: true,
				employee: true
			},
			order: {
				createdAt: 'DESC'
			}
		});

		if (users.length === 0) {
			throw new UnauthorizedException();
		}

		// Filter users based on password match
		users = users.filter((user: IUser) =>
			!!bcrypt.compareSync(password, user.hash) && (!user.employee || user.employee?.isActive)
		);

		/** */
		const code = generateRandomAlphaNumericCode(ALPHA_NUMERIC_CODE_LENGTH);
		const codeExpireAt = moment().add(environment.MAGIC_CODE_EXPIRATION_TIME, 'seconds').toDate();

		/** */
		for await (const user of users) {
			const id = user.id;
			/** */
			await this.userRepository.update({
				id,
				email,
				isActive: true,
				isArchived: false
			}, {
				code,
				codeExpireAt
			});
		}

		// Create an array of user objects with relevant data
		const workspaces: IWorkspaceResponse[] = users.map((user: IUser) => ({
			user: new User({
				id: user.id,
				email: user.email || null,
				name: user.name,
				imageUrl: user.imageUrl,
				tenant: new Tenant({
					id: user.tenant ? user.tenantId : null,
					name: user.tenant?.name || '',
					logo: user.tenant?.logo || ''
				})
			}),
			token: this.generateToken(user, code)
		}));

		// Determining the response based on the number of matching users
		const response: IUserSigninWorkspaceResponse = {
			workspaces: workspaces,
			confirmed_email: email,
			show_popup: workspaces.length > 1,
			total_workspaces: workspaces.length
		};

		if (workspaces.length > 0) {
			return response;
		} else {
			console.log('Error while signin workspace: %s');
			throw new UnauthorizedException();
		}
	}

	/**
	 * Generate a JWT token for the given user.
	 *
	 * @param user - The user object for which to generate the token.
	 * @returns The JWT token as a string.
	 */
	private generateToken(user: IUser, code: string): string {
		const payload: JwtPayload = {
			userId: user.id,
			email: user.email,
			tenantId: user.tenant ? user.tenantId : null,
			code
		};
		return sign(payload, environment.JWT_SECRET, {
			expiresIn: `${environment.JWT_TOKEN_EXPIRATION_TIME}s`,
		});
	}

	/**
	 * Initiates the process to request a password reset.
	 *
	 * @param request - The reset password request object containing the email address.
	 * @param languageCode - The language code used for email communication.
	 * @param originUrl - Optional parameter representing the origin URL of the request.
	 * @returns A Promise that resolves to a boolean indicating the success of the password reset request
	 *          or throws a BadRequestException in case of failure.
	 */
	async requestResetPassword(
		request: IResetPasswordRequest,
		languageCode: LanguagesEnum,
		originUrl?: string
	): Promise<boolean | BadRequestException> {
		try {
			const { email } = request;

			// Fetch users with specific criteria
			const users = await this.fetchUsers(email);
			// Throw an exception if no matching users are found
			if (users.length === 0) {
				throw new BadRequestException('Forgot password request failed!');
			}

			// Initialize an array to store reset links along with tenant and user information
			const tenantUsersMap: { resetLink: string; tenant: ITenant; user: IUser }[] = [];

			// Iterate through users and generate reset links
			for await (const user of users) {
				const { email, tenantId } = user;
				const token = await this.getJwtAccessToken(user);

				// Proceed if a valid token and email are obtained
				if (!!token && !!email) {
					try {
						// Create a password reset request and generate a reset link
						const request = await this.commandBus.execute(
							new PasswordResetCreateCommand({
								email,
								tenantId,
								token
							})
						);
						const resetLink = `${environment.clientBaseUrl}/#/auth/reset-password?token=${request.token}&tenantId=${tenantId}&email=${email}`;
						tenantUsersMap.push({ resetLink, tenant: user.tenant, user });
					} catch (error) {
						throw new BadRequestException('Forgot password request failed!');
					}
				}
			}

			// If there is only one user, send a password reset email
			if (users.length === 1) {
				const [user] = users;
				const [tenantUserMap] = tenantUsersMap;

				if (tenantUserMap) {
					const { resetLink } = tenantUserMap;
					this.emailService.requestPassword(user, resetLink, languageCode, originUrl);
				}
			} else {
				// If multiple users are found, send a multi-tenant password reset email
				this.emailService.multiTenantResetPassword(email, tenantUsersMap, languageCode, originUrl);
			}

			// Return success status
			return true;
		} catch (error) {
			// Throw a BadRequestException in case of failure
			throw new BadRequestException('Forgot password request failed!');
		}
	}

	/**
	 * Fetch users from the repository based on specific criteria.
	 *
	 * @param {string} email - The user's email address.
	 * @returns {Promise<User[]>} A Promise that resolves to an array of User objects.
	 */
	async fetchUsers(email: IUserEmailInput['email']): Promise<IUser[]> {
		return await this.userRepository.find({
			where: {
				email,
				isActive: true,
				isArchived: false,
			},
			relations: {
				tenant: true,
				role: true
			},
		});
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
	 *
	 * @param input
	 * @param languageCode
	 * @returns
	 */
	async register(
		input: IUserRegistrationInput & Partial<IAppIntegrationConfig>,
		languageCode: LanguagesEnum,
	): Promise<User> {
		let tenant = input.user.tenant;
		// 1. If createdById is provided, get the creating user and use their tenant
		if (input.createdById) {
			const creatingUser = await this.userService.findOneByIdString(input.createdById, {
				relations: {
					tenant: true
				}
			});
			tenant = creatingUser.tenant;
		}

		// 2. Register new user
		const userToCreate = this.userRepository.create({
			...input.user,
			tenant,
			...(input.password ? { hash: await this.getPasswordHash(input.password) } : {})
		});
		const createdUser = await this.userRepository.save(userToCreate);

		// 3. Email is automatically verified after accepting an invitation
		if (input.inviteId) {
			await this.userRepository.update(createdUser.id, {
				emailVerifiedAt: freshTimestamp()
			});
		}

		// 4. Find the latest registered user with role
		const user = await this.userRepository.findOne({
			where: {
				id: createdUser.id
			},
			relations: {
				role: true
			}
		});

		// 5. If organizationId is provided, add the user to the organization
		if (isNotEmpty(input.organizationId)) {
			await this.userOrganizationService.addUserToOrganization(user, input.organizationId);
		}

		// 6. Create Import Records while migrating for a relative user
		const { isImporting = false, sourceId = null } = input;
		if (isImporting && sourceId) {
			const { sourceId } = input;
			this.commandBus.execute(
				new ImportRecordUpdateOrCreateCommand({
					entityType: this.userRepository.metadata.tableName,
					sourceId,
					destinationId: user.id
				})
			);
		}

		// Extract integration information
		let integration = pick(input, ['appName', 'appLogo', 'appSignature', 'appLink', 'appEmailConfirmationUrl', 'companyLink', 'companyName']);

		// 7. If the user's email is not verified, send an email verification
		if (!user.emailVerifiedAt) {
			this.emailConfirmationService.sendEmailVerification(
				user,
				integration
			);
		}

		// 8. Send a welcome email to the user
		this.emailService.welcomeUser(
			input.user,
			languageCode,
			input.organizationId,
			input.originalUrl,
			integration
		);

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

	/**
	 *
	 * @param emails
	 * @returns
	 */
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

					// Break the loop and return the response
					return response;
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
			// Extract the user ID from the request
			const userId = request.id;

			// Retrieve the user's data from the userService
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

			// Create a payload for the JWT token
			const payload: JwtPayload = {
				id: user.id,
				tenantId: user.tenantId,
				employeeId: user.employee ? user.employee.id : null
			};

			// Check if the user has a role
			if (user.role) {
				payload.role = user.role.name;

				// Check if the role has rolePermissions
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

			// Generate an access token using the payload and a secret
			const accessToken = sign(payload, environment.JWT_SECRET, {});

			// Return the generated access token
			return accessToken;
		} catch (error) {
			// Handle any errors that occur during the process
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
	 * Sends a unique authentication code to the user's email for workspace sign-in.
	 *
	 * @param input - User email input along with partial app integration configuration.
	 * @param locale - Language/locale for email content.
	 * @returns {Promise<void>} - A promise indicating the completion of the operation.
	 */
	async sendWorkspaceSigninCode(
		input: IUserEmailInput & Partial<IAppIntegrationConfig>,
		locale: LanguagesEnum
	): Promise<void> {
		const { email } = input;

		// Check if the email is provided
		if (!email) {
			return;
		}

		try {
			// Count the number of users with the given email
			const count = await this.userRepository.countBy({
				email
			});

			// If no user found with the email, return
			if (count === 0) {
				return;
			}

			// Generate a random alphanumeric code
			const magicCode = generateRandomAlphaNumericCode(ALPHA_NUMERIC_CODE_LENGTH);

			// Calculate the expiration time for the code
			const codeExpireAt = moment().add(environment.MAGIC_CODE_EXPIRATION_TIME, 'seconds').toDate();

			// Update the user record with the generated code and expiration time
			await this.userRepository.update({ email }, { code: magicCode, codeExpireAt });

			// Extract integration information
			let appIntegration = pick(input, ['appName', 'appLogo', 'appSignature', 'appLink', 'companyLink', 'companyName', 'appMagicSignUrl']);

			// Override the default config by merging in the provided values.
			const integration = deepMerge(environment.appIntegrationConfig, appIntegration);

			/** */
			let magicLink: string;
			if (integration.appMagicSignUrl) {
				magicLink = `${integration.appMagicSignUrl}?email=${email}&code=${magicCode}`;
			}

			// Send the magic code to the user's email
			this.emailService.sendMagicLoginCode({
				email,
				magicCode,
				magicLink,
				locale,
				integration
			});
		} catch (error) {
			// Handle errors during the process
			console.log('Error while sending workspace magic login code', error?.message);
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
					isActive: true,
					isArchived: false
				},
				relations: {
					tenant: true,
					employee: true
				}
			});

			// Create an array of user objects with relevant data
			const workspaces: IWorkspaceResponse[] = [];

			// Create an array of user objects with relevant data
			for await (const user of users) {
				const userId = user.id;
				const tenantId = user.tenant ? user.tenantId : null;
				const employeeId = user.employee ? user.employeeId : null;

				const workspace: IWorkspaceResponse = {
					user: new User({
						id: user.id,
						email: user.email || null,
						name: user.name || null,
						imageUrl: user.imageUrl || null,
						tenant: new Tenant({
							id: user.tenant ? user.tenantId : null,
							name: user.tenant?.name || null,
							logo: user.tenant?.logo || null
						}),
					}),
					token: this.generateToken(user, code),
				};

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

			// Return the response if there are matching users
			if (workspaces.length > 0) {
				return response;
			}
			throw new UnauthorizedException();
		} catch (error) {
			throw new UnauthorizedException();
		}
	}

	/**
	 * Verify workspace signin token
	 *
	 * @param input - The user email and token input.
	 * @returns An object containing user information and tokens.
	 */
	async workspaceSigninVerifyToken(input: IUserEmailInput & IUserTokenInput): Promise<IAuthResponse | null> {
		try {
			const { email, token } = input;

			// Check for missing email or token
			if (!email || !token) {
				throw new UnauthorizedException();
			}

			let payload: JwtPayload | string = this.verifyToken(token);
			if (typeof payload === 'object') {
				const { userId, tenantId, code } = payload;
				const user = await this.userRepository.findOneOrFail({
					where: {
						id: userId,
						email,
						tenantId,
						code,
						codeExpireAt: MoreThanOrEqual(new Date()),
						isActive: true,
						isArchived: false
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

				return {
					user,
					token: access_token,
					refresh_token: refresh_token
				};
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
		query.innerJoin('organization_team_employee',
			p("team_member"),
			p('"team_member"."organizationTeamId" = "organization_team"."id"')
		);

		query.select([
			p(`"${query.alias}"."id" AS "team_id"`),
			p(`"${query.alias}"."name" AS "team_name"`),
			p(`"${query.alias}"."logo" AS "team_logo"`),
			p(`COALESCE(COUNT("team_member"."id"), 0) AS "team_member_count"`),
			p(`"${query.alias}"."profile_link" AS "profile_link"`),
			p(`"${query.alias}"."prefix" AS "prefix")`)
		]);

		query.andWhere(
			p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId }
		);

		// Sub Query to get only assigned teams for specific organizations
		const orgSubQuery = (cb: SelectQueryBuilder<OrganizationTeam>): string => {
			const subQuery = cb.subQuery()
				.select(
					p('"user_organization"."organizationId"')
				).from(
					p("user_organization"),
					p("user_organization")
				);
			subQuery.andWhere(
				p(`"${subQuery.alias}"."isActive" = true`)
			);
			subQuery.andWhere(
				p(`"${subQuery.alias}"."userId" = :userId`), { userId }
			);
			subQuery.andWhere(
				p(`"${subQuery.alias}"."tenantId" = :tenantId`), { tenantId }
			);
			return subQuery.distinct(true).getQuery();
		};

		// Sub Query to get only assigned teams for specific organizations
		query.andWhere((cb: SelectQueryBuilder<OrganizationTeam>) => {
			return (p(`"${query.alias}"."organizationId" IN `) + orgSubQuery(cb));
		});

		// Sub Query to get only assigned teams for a specific employee for specific tenant
		query.andWhere((cb: SelectQueryBuilder<OrganizationTeam>) => {
			const subQuery = cb.subQuery()
				.select(
					p('"organization_team_employee"."organizationTeamId"')
				)
				.from(
					p("organization_team_employee"),
					p("organization_team_employee")
				);
			subQuery.andWhere(
				p(`"${subQuery.alias}"."tenantId" = :tenantId`), { tenantId }
			);

			if (isNotEmpty(employeeId)) {
				subQuery.andWhere(
					p(`"${subQuery.alias}"."employeeId" = :employeeId`), { employeeId }
				);
			}

			// Sub Query to get only assigned teams for specific organizations
			subQuery.andWhere((cb: SelectQueryBuilder<OrganizationTeam>) => {
				return (p(`"${subQuery.alias}"."organizationId" IN `) + orgSubQuery(cb));
			});
			return (p(`"${query.alias}"."id" IN `) + subQuery.distinct(true).getQuery());
		});

		query.addGroupBy(
			p(`"${query.alias}"."id"`)
		);
		query.orderBy(
			p(`"${query.alias}"."createdAt"`), 'DESC'
		);

		return await query.getRawMany();
	}
}
