import { CommandBus } from '@nestjs/cqrs';
import { HttpService } from '@nestjs/axios';
import {
	BadRequestException,
	Injectable,
	InternalServerErrorException,
	NotFoundException,
	UnauthorizedException
} from '@nestjs/common';
import { In, IsNull, MoreThanOrEqual, Not, SelectQueryBuilder } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as moment from 'moment';
import { JsonWebTokenError, JwtPayload, sign, verify } from 'jsonwebtoken';
import { pick } from 'underscore';
import {
	IUserRegistrationInput,
	LanguagesEnum,
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
	ProviderEnum,
	ISocialAccountBase,
	ISocialAccountExistUser,
	ISocialAccountLogin,
	ISocialAccount,
	ILastTeam,
	ILastOrganization,
	ID
} from '@gauzy/contracts';
import { environment } from '@gauzy/config';
import { SocialAuthService } from '@gauzy/auth';
import { IAppIntegrationConfig, createQueryParamsString, deepMerge, isNotEmpty } from '@gauzy/common';
import { AccountRegistrationEvent } from '../event-bus/events';
import { EventBus } from '../event-bus/event-bus';
import { ALPHA_NUMERIC_CODE_LENGTH, DEMO_PASSWORD_LESS_MAGIC_CODE } from './../constants';
import { EmailService } from './../email-send/email.service';
import { UserService } from '../user/user.service';
import { EmployeeService } from '../employee/employee.service';
import { RoleService } from './../role/role.service';
import { UserOrganizationService } from '../user-organization/user-organization.services';
import { ImportRecordUpdateOrCreateCommand } from './../export-import/import-record';
import { PasswordResetCreateCommand, PasswordResetGetCommand } from './../password-reset/commands';
import { RequestContext } from './../core/context';
import { freshTimestamp, generateRandomAlphaNumericCode } from './../core/utils';
import { OrganizationTeam, Tenant, User } from './../core/entities/internal';
import { EmailConfirmationService } from './email-confirmation.service';
import { prepareSQLQuery as p } from './../database/database.helper';
import { TypeOrmUserRepository } from '../user/repository/type-orm-user.repository';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { TypeOrmOrganizationTeamRepository } from './../organization-team/repository/type-orm-organization-team.repository';
import {
	verifyFacebookToken,
	verifyGithubToken,
	verifyGoogleToken,
	verifyTwitterToken
} from './social-account/token-verification/verify-oauth-tokens';
import { SocialAccountService } from './social-account/social-account.service';

@Injectable()
export class AuthService extends SocialAuthService {
	constructor(
		private readonly typeOrmUserRepository: TypeOrmUserRepository,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly typeOrmOrganizationTeamRepository: TypeOrmOrganizationTeamRepository,
		private readonly emailConfirmationService: EmailConfirmationService,
		private readonly userService: UserService,
		private readonly employeeService: EmployeeService,
		private readonly roleService: RoleService,
		private readonly emailService: EmailService,
		private readonly userOrganizationService: UserOrganizationService,
		private readonly commandBus: CommandBus,
		private readonly httpService: HttpService,
		private readonly socialAccountService: SocialAccountService,
		private readonly eventBus: EventBus
	) {
		super();
	}

	/**
	 * User Login Request
	 *
	 * @param email The user's email address
	 * @param password The user's password
	 * @returns A Promise that resolves to the authentication response or null
	 */
	async login({ email, password }: IUserLoginInput): Promise<IAuthResponse | null> {
		try {
			// Find the user by email. Ensure the user is active, not archived, and has a hashed password.
			const user = await this.userService.findOneByOptions({
				where: { email, isActive: true, isArchived: false, hash: Not(IsNull()) },
				relations: { role: true }, // Include user's role in the response
				order: { createdAt: 'DESC' } // Order by creation time, latest first
			});

			// Verify the provided password. If no user is found or the password does not match, throw an error.
			if (!user || !(await bcrypt.compare(password, user.hash))) {
				throw new UnauthorizedException(); // Generic error for security purposes
			}

			// Retrieve the employee details associated with the user.
			const employee = await this.employeeService.findOneByUserId(user.id);

			// Check if the employee is active and not archived. If not, throw an error.
			if (employee && (!employee.isActive || employee.isArchived)) {
				throw new UnauthorizedException();
			}

			// Generate both access and refresh tokens concurrently for efficiency.
			const [access_token, refresh_token] = await Promise.all([
				this.getJwtAccessToken(user),
				this.getJwtRefreshToken(user)
			]);

			// Store the current refresh token with the user for later validation.
			await this.userService.setCurrentRefreshToken(refresh_token, user.id);

			// Set last the login timestamp
			await this.userService.setUserLastLoginTimestamp(user.id);

			// Return the user object with user details, tokens, and optionally employee info if it exists.
			return {
				user: new User({
					...user,
					...(employee && { employee })
				}),
				token: access_token,
				refresh_token: refresh_token
			};
		} catch (error) {
			// Log the error with a timestamp and the error message for debugging.
			console.error(`Login failed at ${new Date().toISOString()}: ${error.message}.`);
			throw new UnauthorizedException(); // Throw a generic error to avoid exposing specific failure reasons.
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
	async signinWorkspacesByEmailPassword(
		input: IUserWorkspaceSigninInput,
		includeTeams: boolean
	): Promise<IUserSigninWorkspaceResponse> {
		const { email, password } = input;

		/** Fetching users matching the query */
		let users = await this.userService.find({
			where: [
				{
					email,
					isActive: true,
					isArchived: false,
					hash: Not(IsNull())
				}
			],
			relations: { tenant: true },
			order: { createdAt: 'DESC' }
		});

		// Filter users based on password match
		users = users.filter((user: IUser) => bcrypt.compareSync(password, user.hash));

		if (users.length === 0) {
			throw new UnauthorizedException();
		}

		const code = generateRandomAlphaNumericCode(ALPHA_NUMERIC_CODE_LENGTH);
		const codeExpireAt = moment().add(environment.MAGIC_CODE_EXPIRATION_TIME, 'seconds').toDate();

		// Update all users with a single query
		const ids = users.map((user: IUser) => user.id);

		await this.typeOrmUserRepository.update(
			{
				id: In(ids),
				email,
				isActive: true,
				isArchived: false
			},
			{
				code,
				codeExpireAt
			}
		);

		// Determining the response based on the number of matching users
		const response: IUserSigninWorkspaceResponse = await this.createUserSigninWorkspaceResponse({
			users,
			code,
			email,
			includeTeams
		});

		if (response.total_workspaces > 0) {
			return response;
		} else {
			console.log('Error while signin workspace: %s');
			throw new UnauthorizedException();
		}
	}

	/**
	 * Verify OAuth token when signin with social media from Ever Teams
	 *
	 * @param provider The provider used with user for signin
	 * @param token The token generated by OAuth provider from Ever Teams frontend
	 * @returns A promise resolved by the provider name and the account ID, both decode from the token
	 * @throws A bad request if the provider used by user is not supported
	 */
	private async verifyOAuthToken(
		provider: ProviderEnum,
		token: string
	): Promise<{ provider: ProviderEnum; id: string; email: string }> {
		switch (provider) {
			case ProviderEnum.GOOGLE:
				return verifyGoogleToken(this.httpService, token);
			case ProviderEnum.GITHUB:
				return verifyGithubToken(this.httpService, token);
			case ProviderEnum.TWITTER:
				return verifyTwitterToken(this.httpService, token);
			case ProviderEnum.FACEBOOK:
				return verifyFacebookToken(this.httpService, token);
			default:
				throw new BadRequestException('Unsupported provider');
		}
	}

	/**
	 * Check if any user with the given provider infos exists
	 * This function is used to facilitate the GauzyAdapter in Ever Teams try to create new Users or only signin them

	 * @param input An object that contains the provider name and the provider Account ID
	 * @returns A promise that resolves to a boolean specifying if the user exists or not
	 */
	async socialSignupCheckIfUserExistsBySocial(input: ISocialAccountBase): Promise<ISocialAccountExistUser> {
		const user = await this.socialAccountService.findUserBySocialId(input);
		if (!user) return { isUserExists: false };
		return { isUserExists: true };
	}

	/**
	 * Authenticate a user by email from social media and return user workspaces.
	 *
	 * @param email - The user's email.
	 * @param password - The user's password.
	 * @returns A promise that resolves to a response with user workspaces.
	 * @throws UnauthorizedException if authentication fails.
	 */
	async signinWorkspacesByEmailSocial(
		input: ISocialAccountLogin,
		includeTeams: boolean
	): Promise<IUserSigninWorkspaceResponse> {
		const { provider: inputProvider, token } = input;

		const providerData = await this.verifyOAuthToken(inputProvider, token);

		const { email, id: providerAccountId, provider } = providerData;
		const socialAccount = await this.socialAccountService.findAccountByProvider({ provider, providerAccountId });

		/** Fetching users matching the query */
		let users = await this.userService.find({
			where: [
				{
					email,
					isActive: true,
					isArchived: false
				}
			],
			relations: { tenant: true },
			order: { createdAt: 'DESC' }
		});

		if (users.length === 0) {
			throw new UnauthorizedException();
		}

		if (!socialAccount) {
			await Promise.all(
				users.map(async (user) => {
					return await this.socialAccountService.registerSocialAccount({
						provider,
						providerAccountId,
						userId: user.id,
						user,
						tenantId: user.tenantId,
						tenant: user.tenant
					});
				})
			);
		}

		const code = generateRandomAlphaNumericCode(ALPHA_NUMERIC_CODE_LENGTH);
		const codeExpireAt = moment().add(environment.MAGIC_CODE_EXPIRATION_TIME, 'seconds').toDate();

		// Update all users with a single query
		const ids = users.map((user: IUser) => user.id);

		await this.typeOrmUserRepository.update(
			{
				id: In(ids),
				email,
				isActive: true,
				isArchived: false
			},
			{
				code,
				codeExpireAt
			}
		);

		// Determining the response based on the number of matching users
		const response: IUserSigninWorkspaceResponse = await this.createUserSigninWorkspaceResponse({
			users,
			code,
			email,
			includeTeams
		});

		if (response.total_workspaces > 0) {
			return response;
		} else {
			console.log('Error while signin workspace: %s');
			throw new UnauthorizedException();
		}
	}

	/**
	 * This method links a user to an oAuth account when signin/signup with a social media provider
	 *
	 * @param input The body request that contains the token to be verified and the provider name
	 * @returns A promise that resolved with  an account creation
	 */

	async linkUserToSocialAccount(input: ISocialAccountLogin): Promise<ISocialAccount> {
		try {
			const { provider: inputProvider, token } = input;

			const providerData = await this.verifyOAuthToken(inputProvider, token);
			const { email, id, provider } = providerData;
			const user = await this.userService.getUserByEmail(email);

			if (!user) {
				throw new BadRequestException('User for these credentials could not be found');
			}
			return await this.socialAccountService.registerSocialAccount({
				provider,
				providerAccountId: id,
				userId: user.id,
				user,
				tenantId: user.tenantId,
				tenant: user.tenant
			});
		} catch (error) {
			throw new BadRequestException('User for these credentials could not be found');
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
			expiresIn: `${environment.JWT_TOKEN_EXPIRATION_TIME}s`
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
			const tenantUsersMap: { resetLink: string; tenant?: ITenant; user: IUser }[] = [];

			// Iterate through users and generate reset links
			for await (const user of users) {
				const { email, tenantId } = user;
				const token = await this.getJwtAccessToken(user);

				// Proceed if a valid token and email are obtained
				if (!!token && !!email) {
					try {
						// Create a password reset request and generate a reset link
						await this.commandBus.execute(
							new PasswordResetCreateCommand({
								email,
								tenantId,
								token
							})
						);

						// Initialize Base URL
						let baseURL = `${environment.clientBaseUrl}/#/auth/reset-password`;

						// Generate the reset link using the helper function
						const resetLink = this.generateResetLink(baseURL, token, email, tenantId);

						// Add the reset link, tenant, and user to the tenantUsersMap array
						tenantUsersMap.push({ resetLink, tenant: user.tenant ?? undefined, user });
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
	 * Generates a password reset link.
	 *
	 * @param baseURL The base URL for the reset password page.
	 * @param token The token generated for the password reset.
	 * @param email The email of the user.
	 * @param tenantId The tenant ID (optional).
	 * @returns The password reset link.
	 */
	generateResetLink(baseURL: string, token: string, email: string, tenantId?: ID): string {
		// Initialize an object to store query parameters
		const params: { [key: string]: string | ID } = { token, email };

		// Add tenantId to the reset link only if it's available
		if (tenantId) {
			params['tenantId'] = tenantId;
		}

		// Convert query params object to a string
		const queryString = createQueryParamsString(params);

		// Combine base URL with query params
		return `${baseURL}?${queryString}`;
	}

	/**
	 * Fetch users from the repository based on specific criteria.
	 *
	 * @param {string} email - The user's email address.
	 * @returns {Promise<User[]>} A Promise that resolves to an array of User objects.
	 */
	async fetchUsers(email: IUserEmailInput['email']): Promise<IUser[]> {
		// Find users matching the criteria
		return await this.typeOrmUserRepository.find({
			where: { email, isActive: true, isArchived: false },
			relations: { tenant: true, role: true }
		});
	}

	/**
	 * Resets the user's password based on a valid password reset token.
	 *
	 * @param request - The request object containing the new password and the reset token.
	 * @returns A boolean indicating whether the password reset was successful.
	 * @throws {BadRequestException} - If the password reset fails due to an invalid or expired token, or if there is an issue updating the password.
	 */
	async resetPassword(request: IChangePasswordRequest) {
		try {
			const { password, token } = request;

			// Validate the password reset token
			const record: IPasswordReset = await this.commandBus.execute(new PasswordResetGetCommand({ token }));
			if (record.expired) {
				throw new BadRequestException('Password Reset Failed: Token has expired.');
			}

			// Verify the token and extract user information
			const { id, tenantId } = verify(token, environment.JWT_SECRET) as {
				id: ID;
				tenantId: ID;
			};

			// Fetch the user by ID and tenant
			const user = await this.userService.findOneByIdString(id, {
				where: { tenantId },
				relations: { tenant: true }
			});

			if (!user) {
				throw new NotFoundException('Password Reset Failed.');
			}

			// Hash the new password and update it for the user
			const hash = await this.getPasswordHash(password);
			await this.userService.changePassword(user.id, hash);

			return true;
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
		languageCode: LanguagesEnum
	): Promise<User> {
		let tenant = input.user.tenant;
		const { organizationId } = input;

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
		const entity = this.typeOrmUserRepository.create({
			...input.user,
			tenant,
			...(input.password ? { hash: await this.getPasswordHash(input.password) } : {})
		});
		let user = await this.typeOrmUserRepository.save(entity);

		// 3. Create employee for specific user
		if (input.featureAsEmployee) {
			await this.typeOrmEmployeeRepository.save(
				this.typeOrmEmployeeRepository.create({
					...input,
					user,
					tenantId: tenant.id,
					tenant: { id: tenant.id },
					organizationId,
					organization: { id: organizationId }
				})
			);
		}

		// 4. Email is automatically verified after accepting an invitation
		if (input.inviteId) {
			await this.typeOrmUserRepository.update(user.id, {
				emailVerifiedAt: freshTimestamp()
			});
		}

		// 5. Find the latest registered user with role
		user = await this.typeOrmUserRepository.findOne({
			where: { id: user.id },
			relations: { role: true }
		});

		// 6. If organizationId is provided, add the user to the organization
		if (isNotEmpty(input.organizationId)) {
			await this.userOrganizationService.addUserToOrganization(user, input.organizationId);
		}

		// 7. Create Import Records while migrating for a relative user
		if (input.isImporting && input.sourceId) {
			this.commandBus.execute(
				new ImportRecordUpdateOrCreateCommand({
					entityType: this.typeOrmUserRepository.metadata.tableName,
					sourceId: input.sourceId,
					destinationId: user.id
				})
			);
		}

		// Extract integration information
		let integration = pick(input, [
			'appName',
			'appLogo',
			'appSignature',
			'appLink',
			'appEmailConfirmationUrl',
			'companyLink',
			'companyName'
		]);

		// 8. If the user's email is not verified, send an email verification
		if (!user.emailVerifiedAt) {
			this.emailConfirmationService.sendEmailVerification(user, integration);
		}

		// Publish the account registration event
		const ctx = RequestContext.currentRequestContext();
		const event = new AccountRegistrationEvent(ctx, user); // ToDo: Send a welcome email to user from events
		await this.eventBus.publish(event);

		// 9. Send a welcome email to the user
		this.emailService.welcomeUser(input.user, languageCode, input.organizationId, input.originalUrl, integration);
		return user;
	}

	/**
	 *
	 * @param id
	 * @param thirdPartyId
	 * @returns
	 */
	async getAuthenticatedUser(id: string, thirdPartyId?: string): Promise<User> {
		return thirdPartyId ? this.userService.getIfExistsThirdParty(thirdPartyId) : this.userService.getIfExists(id);
	}

	/**
	 *
	 * @param token
	 * @returns
	 */
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
	 * Check if the current user has any of the specified roles
	 *
	 * @param roles Array of role names to check against
	 * @returns A promise that resolves to true if the user has one of the specified roles, false otherwise
	 */
	async hasRole(roles: string[] = []): Promise<boolean> {
		try {
			// Get the current role ID from the request context
			const currentRoleId = RequestContext.currentRoleId();

			// Retrieve the role associated with the current user
			const role = await this.roleService.findOneByIdString(currentRoleId);

			// Check if the role has any of the specified roles
			return role ? roles.includes(role.name) : false;
		} catch (err) {
			if (err instanceof JsonWebTokenError) {
				return false;
			}
		}
	}

	/**
	 * Check if the current user has any of the specified permissions
	 *
	 * @param permissions Array of permissions to check against
	 * @returns A promise that resolves to true if the user has one of the specified permissions, false otherwise
	 */
	async hasPermissions(permissions: PermissionsEnum[] = []): Promise<boolean> {
		try {
			// Get the current role ID from the request context
			const roleId = RequestContext.currentRoleId();

			//	Check if the role has any of the specified permissions
			const count = await this.roleService.countBy({
				id: roleId,
				isActive: true,
				isArchived: false,
				rolePermissions: {
					permission: In(permissions),
					enabled: true,
					isActive: true,
					isArchived: false
				}
			});
			return count > 0;
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
	 * Generates a JWT access token for a given user.
	 *
	 * This function takes a partial user object, primarily the user's ID,
	 * and retrieves the user's details including their role and permissions.
	 * It then constructs a JWT payload and generates a token.
	 * If the user does not exist, an error is thrown.
	 *
	 * @param request A partial IUser object, mainly containing the user's ID.
	 * @returns A Promise that resolves to a JWT access token string.
	 * @throws Throws an UnauthorizedException if the user is not found or if there is an issue in token generation.
	 */
	public async getJwtAccessToken(request: Partial<IUser>) {
		try {
			// Validate that the request contains a user ID
			if (!request.id) {
				throw new Error('User ID is missing in the request.');
			}

			console.log('Request getJwtAccessToken with Id: ', request.id);

			// Extract the user ID from the request
			const userId = request.id;

			// Retrieve the user's data, including role and permissions
			const user = await this.userService.findOneByIdString(userId, {
				relations: { role: { rolePermissions: true } },
				order: { createdAt: 'DESC' }
			});

			// Throw an error if the user is not found
			if (!user) {
				console.error(`User not found: ${request.id}`);
				throw new UnauthorizedException();
			}

			// Retrieve the employee details associated with the user.
			const employee = await this.employeeService.findOneByUserId(user.id);

			// Create a payload for the JWT token
			const payload: JwtPayload = {
				id: user.id,
				tenantId: user.tenantId ?? null,
				employeeId: employee ? employee.id : null,
				role: user.role ? user.role.name : null,
				permissions: user.role?.rolePermissions?.filter((rp) => rp.enabled).map((rp) => rp.permission) ?? null
			};

			// Generate the JWT access token using the payload
			return sign(payload, environment.JWT_SECRET, {});
		} catch (error) {
			// Log and rethrow any errors encountered during the process
			console.log('Error while generating JWT access token:', error);
			throw new UnauthorizedException();
		}
	}

	/**
	 * Generates a JWT refresh token for a given user.
	 *
	 * This function takes a user object and constructs a JWT payload with the user's
	 * ID, email, tenant ID, and role. It then generates a refresh token based on this payload.
	 *
	 * @param user A partial IUser object containing at least the user's ID, email, and role.
	 * @returns A Promise that resolves to a JWT refresh token string.
	 * @throws Logs an error and throws an exception if the token generation fails.
	 */
	public async getJwtRefreshToken(user: Partial<IUser>) {
		try {
			// Ensure the user object contains the necessary information
			if (!user.id || !user.email) {
				throw new Error('User ID or email is missing.');
			}

			// Construct the JWT payload
			const payload: JwtPayload = {
				id: user.id,
				email: user.email,
				tenantId: user.tenantId || null,
				role: user.role ? user.role.name : null
			};

			// Generate the JWT refresh token
			return sign(payload, environment.JWT_REFRESH_TOKEN_SECRET, {
				expiresIn: `${environment.JWT_REFRESH_TOKEN_EXPIRATION_TIME}s`
			});
		} catch (error) {
			console.log('Error while generating JWT refresh token:', error);
		}
	}

	/**
	 * Get JWT access token from JWT refresh token
	 *
	 * @returns {Promise<{ token: string } | null>}
	 */
	async getAccessTokenFromRefreshToken(): Promise<{ token: string } | null> {
		try {
			// Get the current user from the request context
			const user = RequestContext.currentUser();

			// If no user is found, return null
			if (!user) return null;

			// Get and return the JWT access token for the user
			const token = await this.getJwtAccessToken(user);
			return { token };
		} catch (error) {
			// Use console.error for error logging with more descriptive context
			console.error('Error while retrieving JWT access token from refresh token:', error);
			return null;
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
			console.log('Error while sending workspace magic login code: Email is required');
			return;
		}

		try {
			// Count the number of users with the given email
			const count = await this.typeOrmUserRepository.countBy({
				email
			});

			// If no user found with the email, return
			if (count === 0) {
				console.log(`Error while sending workspace magic login code: No user found with the email ${email}`);
				return;
			}

			// Generate a random alphanumeric code
			let magicCode: string;

			let isDemoCode = false;

			// Check if the environment variable 'DEMO' is set to 'true' and the Node.js environment is set to 'development'
			const IS_DEMO = process.env.DEMO === 'true' && process.env.NODE_ENV === 'development';

			console.log('Auth Is Demo: ', IS_DEMO);

			// If it's a demo environment, handle special cases
			if (IS_DEMO) {
				const demoEmployeeEmail = environment.demoCredentialConfig?.employeeEmail || 'employee@ever.co';
				const demoAdminEmail = environment.demoCredentialConfig?.adminEmail || 'local.admin@ever.co';

				console.log('Demo Employee Email: ', demoEmployeeEmail);
				console.log('Demo Admin Email: ', demoAdminEmail);

				// Check the value of the 'email' variable against certain demo email addresses
				if (email === demoEmployeeEmail || email === demoAdminEmail) {
					magicCode = environment.demoCredentialConfig?.employeePassword || DEMO_PASSWORD_LESS_MAGIC_CODE;
					isDemoCode = true;
				}
			}

			if (!isDemoCode) {
				magicCode = generateRandomAlphaNumericCode(ALPHA_NUMERIC_CODE_LENGTH);
			}

			// Calculate the expiration time for the code
			const codeExpireAt = moment()
				.add(environment.MAGIC_CODE_EXPIRATION_TIME || 600, 'seconds')
				.toDate();

			// Update the user record with the generated code and expiration time
			await this.typeOrmUserRepository.update({ email }, { code: magicCode, codeExpireAt });

			console.log(`Email: '${email}' magic code: '${magicCode}' expires at: '${codeExpireAt}'`);

			// If it's not a demo code, send the magic code to the user's email
			if (!isDemoCode) {
				// Extract integration information
				let appIntegration = pick(input, [
					'appName',
					'appLogo',
					'appSignature',
					'appLink',
					'companyLink',
					'companyName',
					'appMagicSignUrl'
				]);

				// Override the default config by merging in the provided values.
				const integration = deepMerge(environment.appIntegrationConfig, appIntegration);

				let magicLink: string;

				if (integration.appMagicSignUrl) {
					magicLink = `${integration.appMagicSignUrl}?email=${email}&code=${magicCode}`;
				}

				console.log('Magic Link: ', magicLink);

				// Send the magic code to the user's email
				this.emailService.sendMagicLoginCode({
					email,
					magicCode,
					magicLink,
					locale,
					integration
				});
			}
		} catch (error) {
			console.log(`Error while sending workspace magic login code for email: ${email}`, error?.message);
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
			let users = await this.typeOrmUserRepository.find({
				where: {
					email,
					code,
					codeExpireAt: MoreThanOrEqual(new Date()),
					isActive: true,
					isArchived: false
				},
				relations: { tenant: true }
			});

			// Determining the response based on the number of matching users
			const response: IUserSigninWorkspaceResponse = await this.createUserSigninWorkspaceResponse({
				users,
				code,
				email,
				includeTeams
			});

			// Return the response if there are matching users
			if (response.total_workspaces > 0) {
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
	async workspaceSigninVerifyToken(
		input: IUserEmailInput & IUserTokenInput & ILastOrganization & ILastTeam
	): Promise<IAuthResponse | null> {
		try {
			const { email, token, lastOrganizationId, lastTeamId } = input;

			// Check for missing email or token
			if (!email || !token) {
				throw new UnauthorizedException();
			}

			let payload: JwtPayload | string = this.verifyToken(token);
			if (typeof payload === 'object') {
				const { userId, tenantId, code } = payload;

				const user = await this.typeOrmUserRepository.findOneOrFail({
					where: {
						id: userId,
						email,
						tenantId,
						code,
						codeExpireAt: MoreThanOrEqual(new Date()),
						isActive: true,
						isArchived: false
					},
					relations: { role: true }
				});

				await this.typeOrmUserRepository.update(
					{
						email,
						id: userId,
						tenantId,
						code,
						isActive: true,
						isArchived: false
					},
					{
						code: null,
						codeExpireAt: null,
						lastLoginAt: new Date(),
						lastOrganizationId: lastOrganizationId ?? user.lastOrganizationId,
						lastTeamId
					}
				);

				// Retrieve the employee details associated with the user.
				const employee = await this.employeeService.findOneByUserId(user.id);

				// Check if the employee is active and not archived. If not, throw an error.
				if (employee && (!employee.isActive || employee.isArchived)) {
					throw new UnauthorizedException();
				}

				// Generate both access and refresh tokens concurrently for efficiency.
				const [access_token, refresh_token] = await Promise.all([
					this.getJwtAccessToken(user),
					this.getJwtRefreshToken(user)
				]);

				// Store the current refresh token with the user for later validation.
				await this.userService.setCurrentRefreshToken(refresh_token, user.id);

				// Update the last login timestamp for the user
				await this.userService.setUserLastLoginTimestamp(user.id);

				// Return the user object with user details, tokens, and optionally employee info if it exists.
				return {
					user: new User({
						...user,
						...(employee && { employee })
					}),
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
	private async getTeamsForUser(tenantId: ID, userId: ID, employeeId: ID | null): Promise<IOrganizationTeam[]> {
		const query = this.typeOrmOrganizationTeamRepository.createQueryBuilder('organization_team');
		query.innerJoin(
			`organization_team_employee`,
			`team_member`,
			p('"team_member"."organizationTeamId" = "organization_team"."id"')
		);

		query.select([
			p(`"${query.alias}"."id" AS "team_id"`),
			p(`"${query.alias}"."name" AS "team_name"`),
			p(`"${query.alias}"."logo" AS "team_logo"`),
			p(`COALESCE(COUNT("team_member"."id"), 0) AS "team_member_count"`),
			p(`"${query.alias}"."profile_link" AS "profile_link"`),
			p(`"${query.alias}"."prefix" AS "prefix"`)
		]);

		query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId });
		query.andWhere(p(`"${query.alias}"."isActive" = :isActive`), { isActive: true });
		query.andWhere(p(`"${query.alias}"."isArchived" = :isArchived`), { isArchived: false });

		// Sub Query to get only assigned teams for specific organizations
		const orgSubQuery = (cb: SelectQueryBuilder<OrganizationTeam>): string => {
			const subQuery = cb
				.subQuery()
				.select(p('"user_organization"."organizationId"'))
				.from('user_organization', 'user_organization');
			subQuery.andWhere(p(`"${subQuery.alias}"."isActive" = :isActive`), { isActive: true });
			subQuery.andWhere(p(`"${subQuery.alias}"."isArchived" = :isArchived`), { isArchived: false });
			subQuery.andWhere(p(`"${subQuery.alias}"."userId" = :userId`), { userId });
			subQuery.andWhere(p(`"${subQuery.alias}"."tenantId" = :tenantId`), { tenantId });
			return subQuery.distinct(true).getQuery();
		};

		// Sub Query to get only assigned teams for specific organizations
		query.andWhere((cb: SelectQueryBuilder<OrganizationTeam>) => {
			return p(`"${query.alias}"."organizationId" IN ` + orgSubQuery(cb));
		});

		// Sub Query to get only assigned teams for a specific employee for specific tenant
		query.andWhere((cb: SelectQueryBuilder<OrganizationTeam>) => {
			const subQuery = cb
				.subQuery()
				.select(p('"organization_team_employee"."organizationTeamId"'))
				.from('organization_team_employee', 'organization_team_employee');
			subQuery.andWhere(p(`"${subQuery.alias}"."isActive" = :isActive`), { isActive: true });
			subQuery.andWhere(p(`"${subQuery.alias}"."isArchived" = :isArchived`), { isArchived: false });
			subQuery.andWhere(p(`"${subQuery.alias}"."tenantId" = :tenantId`), { tenantId });

			if (isNotEmpty(employeeId)) {
				subQuery.andWhere(p(`"${subQuery.alias}"."employeeId" = :employeeId`), { employeeId });
			}

			// Sub Query to get only assigned teams for specific organizations
			subQuery.andWhere((cb: SelectQueryBuilder<OrganizationTeam>) => {
				return p(`"${subQuery.alias}"."organizationId" IN ` + orgSubQuery(cb));
			});

			return p(`"${query.alias}"."id" IN ` + subQuery.distinct(true).getQuery());
		});

		query.addGroupBy(p(`"${query.alias}"."id"`));
		query.orderBy(p(`"${query.alias}"."createdAt"`), 'DESC');

		return await query.getRawMany();
	}

	/**
	 * Creates workspace response objects for a list of users.
	 *
	 * @param {Object} params - The parameters.
	 * @param {IUser[]} params.users - The list of users.
	 * @param {string} params.email - The email address.
	 * @param {string} params.code - The code for workspace signin.
	 * @param {boolean} params.includeTeams - Flag to include teams in the response.
	 * @returns {Promise<IUserSigninWorkspaceResponse>} A promise that resolves to the workspace response.
	 */
	private async createUserSigninWorkspaceResponse({
		users,
		email,
		code,
		includeTeams
	}: {
		users: IUser[];
		email: string;
		code: string;
		includeTeams: boolean;
	}): Promise<IUserSigninWorkspaceResponse> {
		const workspaces: IWorkspaceResponse[] = [];

		// Iterate through the users and create workspaces for each user
		for (const user of users) {
			const workspace = await this.createWorkspace(user, code, includeTeams);
			workspaces.push(workspace);
		}

		return {
			workspaces,
			confirmed_email: email,
			show_popup: workspaces.length > 1,
			total_workspaces: workspaces.length
		};
	}

	/**
	 * Creates a workspace response object for a given user.
	 *
	 * @param user The user object of type IUser.
	 * @param code The code used for generating the user token.
	 * @param includeTeams Flag indicating whether to include team information in the response.
	 * @returns A promise that resolves to the workspace response object of type IWorkspaceResponse.
	 */
	private async createWorkspace(user: IUser, code: string, includeTeams: boolean): Promise<IWorkspaceResponse> {
		const tenantId = user.tenant ? user.tenantId : null;
		const employeeId = await this.employeeService.findEmployeeIdByUserId(user.id);

		const workspace: IWorkspaceResponse = {
			user: this.createUserObject(user),
			token: this.generateToken(user, code)
		};

		if (includeTeams) {
			try {
				console.time('Get teams for a user within a specific tenant');

				const teams = await this.getTeamsForUser(tenantId, user.id, employeeId);
				workspace['current_teams'] = teams;

				console.timeEnd('Get teams for a user within a specific tenant');
			} catch (error) {
				console.error('Error while getting specific teams for specific tenant:', error?.message);
				// Optionally, you might want to handle the error more explicitly here.
			}
		}

		return workspace;
	}

	/**
	 * Creates a new User object from a given IUser object.
	 *
	 * @param user The IUser object to be transformed.
	 * @returns A new User object with properties mapped from the IUser object.
	 */
	private createUserObject(user: IUser): User {
		return new User({
			id: user.id,
			email: user.email || null, // Sets email to null if it's undefined
			name: user.name || null, // Sets name to null if it's undefined
			imageUrl: user.imageUrl || null, // Sets imageUrl to null if it's undefined
			lastTeamId: user.lastTeamId || null, // Sets lastTeam id to null if it's undefined
			lastLoginAt: user.lastLoginAt || null, // Sets last logout timestamp to null if it's undefined
			tenant: user.tenant
				? new Tenant({
						id: user.tenant.id, // Assuming tenantId is a direct property of tenant
						name: user.tenant.name || '', // Defaulting to an empty string if name is undefined
						logo: user.tenant.logo || '' // Defaulting to an empty string if logo is undefined
				  })
				: null // Sets tenant to null if user.tenant is undefined
		});
	}
}
