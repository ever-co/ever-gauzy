import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { JwtPayload, sign, verify } from 'jsonwebtoken';
import { FindManyOptions, FindOptionsWhere, In, IsNull, MoreThanOrEqual, Not, SelectQueryBuilder } from 'typeorm';
import { addDays } from 'date-fns';
import { pick } from 'underscore';
import { ConfigService, environment } from '@gauzy/config';
import { DEFAULT_INVITE_EXPIRY_PERIOD } from '@gauzy/constants';
import {
	ICreateEmailInvitesInput,
	ICreateEmailInvitesOutput,
	InviteStatusEnum,
	IUser,
	ICreateOrganizationContactInviteInput,
	RolesEnum,
	LanguagesEnum,
	IOrganization,
	IEmployee,
	IRole,
	InvitationExpirationEnum,
	IInvite,
	InvitationTypeEnum,
	IOrganizationTeam,
	IInviteResendInput,
	InviteActionEnum,
	IUserRegistrationInput,
	IPagination,
	ID
} from '@gauzy/contracts';
import { IAppIntegrationConfig } from '@gauzy/common';
import { generateAlphaNumericCode, isEmpty, isNotEmpty } from '@gauzy/utils';
import { BaseQueryDTO, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import {
	MultiORMEnum,
	freshTimestamp,
	getArrayIntersection,
	parseTypeORMFindToMikroOrm,
	retryQuery
} from './../core/utils';
import { EmailService } from './../email-send/email.service';
import { UserService } from '../user/user.service';
import { RoleService } from './../role/role.service';
import { OrganizationService } from './../organization/organization.service';
import { OrganizationTeamService } from './../organization-team/organization-team.service';
import { OrganizationDepartmentService } from './../organization-department/organization-department.service';
import { OrganizationContactService } from './../organization-contact/organization-contact.service';
import { OrganizationProjectService } from './../organization-project/organization-project.service';
import { AuthService } from './../auth/auth.service';
import { UserOrganizationService } from './../user-organization/user-organization.services';
import { TypeOrmUserRepository } from '../user/repository/type-orm-user.repository';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { TypeOrmOrganizationTeamEmployeeRepository } from '../organization-team-employee/repository/type-orm-organization-team-employee.repository';
import { TypeOrmInviteRepository } from './repository/type-orm-invite.repository';
import { MikroOrmInviteRepository } from './repository/mikro-orm-invite.repository';
import { Invite } from './invite.entity';
import { InviteAcceptCommand } from './commands';

@Injectable()
export class InviteService extends TenantAwareCrudService<Invite> {
	constructor(
		readonly typeOrmInviteRepository: TypeOrmInviteRepository,
		readonly mikroOrmInviteRepository: MikroOrmInviteRepository,
		readonly typeOrmUserRepository: TypeOrmUserRepository,
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly typeOrmOrganizationTeamEmployeeRepository: TypeOrmOrganizationTeamEmployeeRepository,
		private readonly configService: ConfigService,
		private readonly emailService: EmailService,
		private readonly organizationContactService: OrganizationContactService,
		private readonly organizationDepartmentService: OrganizationDepartmentService,
		private readonly organizationProjectService: OrganizationProjectService,
		private readonly organizationService: OrganizationService,
		private readonly organizationTeamService: OrganizationTeamService,
		private readonly roleService: RoleService,
		private readonly userService: UserService,
		private readonly authService: AuthService,
		private readonly commandBus: CommandBus,
		private readonly userOrganizationService: UserOrganizationService
	) {
		super(typeOrmInviteRepository, mikroOrmInviteRepository);
	}

	/**
	 * Fetches organization-related data in parallel.
	 *
	 * @param projectIds - An array of project IDs.
	 * @param departmentIds - An array of department IDs.
	 * @param organizationContactIds - An array of organization contact IDs.
	 * @param teamIds - An array of team IDs.
	 * @param organizationId - The current organization ID.
	 * @param tenantId - The current tenant ID.
	 * @returns An object containing projects, departments, organizationContacts, and organizationTeams.
	 */
	async fetchInvitesRelations(
		projectIds: ID[] | undefined,
		departmentIds: ID[] | undefined,
		organizationContactIds: ID[] | undefined,
		teamIds: ID[] | undefined,
		organizationId: ID,
		tenantId: ID
	): Promise<{
		projects: any[];
		departments: any[];
		organizationContacts: any[];
		organizationTeams: any[];
	}> {
		const [projects, departments, organizationContacts, organizationTeams] = await Promise.all([
			retryQuery(() =>
				this.organizationProjectService.find({
					where: { id: In(projectIds ?? []), organizationId, tenantId }
				})
			),
			retryQuery(() =>
				this.organizationDepartmentService.find({
					where: { id: In(departmentIds ?? []), organizationId, tenantId }
				})
			),
			retryQuery(() =>
				this.organizationContactService.find({
					where: { id: In(organizationContactIds ?? []), organizationId, tenantId }
				})
			),
			retryQuery(() =>
				this.organizationTeamService.find({
					where: { id: In(teamIds ?? []), organizationId, tenantId }
				})
			)
		]);

		return { projects, departments, organizationContacts, organizationTeams };
	}

	/**
	 * Creates all invites. If an email Id already exists, this function will first delete
	 * the existing invite and then create a new row with the email address.
	 * @param emailInvites Emails Ids to send invite
	 */
	async createBulk(input: ICreateEmailInvitesInput, languageCode: LanguagesEnum): Promise<ICreateEmailInvitesOutput> {
		const originUrl = this.configService.get('clientBaseUrl') as string;
		const tenantId = RequestContext.currentTenantId() ?? input.tenantId;

		const {
			emailIds = [],
			projectIds = [],
			organizationContactIds = [],
			departmentIds = [],
			teamIds = [],
			roleId,
			organizationId,
			startedWorkOn,
			appliedDate,
			invitationExpirationPeriod,
			fullName,
			callbackUrl
		} = input;

		/**
		 * Fetch organization-related data in parallel.
		 */
		const { projects, departments, organizationContacts, organizationTeams } = await this.fetchInvitesRelations(
			projectIds,
			departmentIds,
			organizationContactIds,
			teamIds,
			organizationId,
			tenantId
		);

		/**
		 * Retrieve the invited user and organization.
		 */
		const invitedByUserId = RequestContext.currentUserId();
		const invitedByUser: IUser = await this.userService.findOneByIdString(invitedByUserId, {
			relations: { role: true }
		});

		// Invited Role
		let role: IRole;

		try {
			const currentRoleId = RequestContext.currentRoleId();

			// Ensure the current role can only invite others with the 'EMPLOYEE' role
			role = await this.roleService.findOneByIdString(currentRoleId, {
				where: { name: RolesEnum.EMPLOYEE }
			});
		} catch (error) {
			// If the current role is not an 'EMPLOYEE' role, fallback to specified 'roleId'
			role = await this.roleService.findOneByIdString(roleId);

			// Handle unauthorized access if the invitedByUser is not a 'SUPER_ADMIN'
			if (role.name === RolesEnum.SUPER_ADMIN && invitedByUser.role.name !== RolesEnum.SUPER_ADMIN) {
				throw new UnauthorizedException();
			}
		}

		// Invited Organization
		const organization: IOrganization = await this.organizationService.findOneByIdString(organizationId);

		// Build the "where" clause based on provided conditions.
		const expireDate =
			invitationExpirationPeriod === InvitationExpirationEnum.NEVER
				? null
				: addDays(
						new Date(),
						Number(invitationExpirationPeriod ?? organization.inviteExpiryPeriod) ||
							DEFAULT_INVITE_EXPIRY_PERIOD
				  );

		// Build the overall query options.
		const queryOptions = {
			where: {
				tenantId,
				...(isNotEmpty(organizationId) && { organizationId }),
				...(isNotEmpty(emailIds) && { email: In(emailIds) })
			},
			...(isNotEmpty(teamIds) && { relations: { teams: true } })
		};

		const { items: existedInvites } = await this.findAll(queryOptions);

		let ignoreInvites = 0;
		const invites: Invite[] = [];

		for await (const email of emailIds) {
			const code = generateAlphaNumericCode();
			const token = sign({ email, code }, environment.JWT_SECRET, {});

			// Retrieve organization team employees for the email.
			const organizationTeamEmployees = await this.typeOrmOrganizationTeamEmployeeRepository.findBy({
				employee: { user: { email } },
				organizationTeamId: In(teamIds)
			});

			// Retrieve the IDs of the teams the user is already in.
			const alreadyInTeamIds: ID[] =
				organizationTeamEmployees.length > 0
					? organizationTeamEmployees.map((emp) => emp.organizationTeamId)
					: [];

			// Retrieve the invites that match the email and teams.
			const matchedInvites = existedInvites.filter(
				({ email: inviteEmail, teams }) =>
					inviteEmail === email && getArrayIntersection(teams?.map(({ id }) => id) ?? [], teamIds).length > 0
			);

			// Determine teams to invite.
			let teamsToInvite: IOrganizationTeam[];

			if (isNotEmpty(matchedInvites)) {
				// Check if all invites are already sent.
				const allInvitesNotSent = matchedInvites.every((invite) => invite.status !== InviteStatusEnum.INVITED);

				// Determine teams to invite.
				teamsToInvite = allInvitesNotSent
					? organizationTeams.filter((team) => !alreadyInTeamIds.includes(team.id))
					: [];

				if (isEmpty(teamsToInvite)) {
					ignoreInvites++;
					continue;
				}
			} else {
				teamsToInvite = organizationTeams;
			}

			// Create a new Invite instance with common properties.
			invites.push(
				new Invite({
					token,
					email,
					roleId,
					organizationId,
					tenantId,
					invitedByUserId,
					status: InviteStatusEnum.INVITED,
					expireDate,
					actionDate: startedWorkOn ?? appliedDate,
					code,
					fullName,
					projects,
					teams: teamsToInvite,
					departments,
					organizationContacts
				})
			);
		}

		const items = await this.typeOrmRepository.save(invites);

		items.forEach((item: IInvite) => {
			let inviteLink: string = this.createAcceptInvitationUrl(originUrl, item.email, item.token);

			if (input.inviteType === InvitationTypeEnum.TEAM && callbackUrl) {
				// Convert query params object to string
				const queryParamsString = this.buildQueryString({
					email: item.email,
					code: item.code
				});
				inviteLink = [callbackUrl, queryParamsString].filter(Boolean).join('?'); // Combine current URL with updated query params
			}

			switch (input.inviteType) {
				case InvitationTypeEnum.USER:
					this.emailService.inviteUser({
						email: item.email,
						role: role.name,
						organization,
						registerUrl: inviteLink,
						originUrl,
						languageCode,
						invitedByUser
					});
					break;

				case InvitationTypeEnum.EMPLOYEE:
				case InvitationTypeEnum.CANDIDATE:
					this.emailService.inviteEmployee({
						email: item.email,
						registerUrl: inviteLink,
						organizationContacts,
						departments,
						originUrl,
						organization,
						languageCode,
						invitedByUser
					});
					break;

				case InvitationTypeEnum.TEAM:
					this.emailService.inviteTeamMember({
						email: item.email,
						teams: item.teams.map((team: IOrganizationTeam) => team.name).join(', '),
						languageCode,
						invitedByUser,
						organization,
						inviteCode: item.code,
						inviteLink,
						originUrl
					});
					break;

				default:
					throw new Error(`Unknown invitation type: ${input.inviteType}`);
			}
		});

		return { items, total: items.length, ignored: ignoreInvites };
	}

	/**
	 * Generates the register URL for accepting invites.
	 * @param origin - The base URL.
	 * @param email - The email of the invitee.
	 * @param token - The token for the invite.
	 * @returns The full URL with query parameters.
	 */
	private createAcceptInvitationUrl(origin: string, email: string, token: string): string {
		const acceptInviteUrl = `${origin}/#/auth/accept-invite`;
		const queryParamsString = this.buildQueryString({ email, token });
		return [acceptInviteUrl, queryParamsString].filter(Boolean).join('?'); // Combine current URL with updated query params
	}

	/**
	 * Creates a query parameters string from an object of query parameters.
	 * @param queryParams An object containing query parameters.
	 * @returns A string representation of the query parameters.
	 */
	private buildQueryString(queryParams: { [key: string]: string | string[] | boolean }): string {
		return Object.keys(queryParams)
			.map((key) => {
				const value = queryParams[key];
				if (Array.isArray(value)) {
					return value.map((v) => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`).join('&');
				} else {
					return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
				}
			})
			.join('&');
	}

	/**
	 * Generates an invite code and a secure JWT token for email-based invites.
	 *
	 * @param {string} email - The email address for which the invite code and token are generated.
	 * @returns {{ code: string; token: string }} - An object containing the invite code and JWT token.
	 */
	private generateInviteCodeAndToken(email: string): { code: string; token: string } {
		// Generate a unique invite code
		const code = generateAlphaNumericCode();

		// Generate a JWT token containing the email and invite code
		const token = sign({ email, code }, environment.JWT_SECRET, {});

		return { code, token };
	}

	async resendEmail(input: IInviteResendInput, languageCode: LanguagesEnum) {
		const originUrl = this.configService.get('clientBaseUrl') as string;
		const { inviteId, inviteType, callbackUrl } = input;

		// Retrieve the invite
		const invite: IInvite = await this.findOneByIdString(inviteId, {
			relations: {
				organization: true,
				role: true,
				teams: true
			}
		});
		if (!invite) {
			throw Error('Invite does not exist');
		}

		// Invited organization
		const organization: IOrganization = invite.organization;

		const role: IRole = invite.role;
		const email: IInvite['email'] = invite.email;
		const teams: IOrganizationTeam[] = invite.teams;

		/**
		 * Invited by the user.
		 */
		const invitedByUserId = RequestContext.currentUserId();
		const invitedByUser: IUser = await this.userService.findOneByIdString(invitedByUserId);

		try {
			const { code, token } = this.generateInviteCodeAndToken(email);

			const registerUrl = `${originUrl}/#/auth/accept-invite?email=${encodeURIComponent(email)}&token=${token}`;
			if (inviteType === InvitationTypeEnum.USER) {
				this.emailService.inviteUser({
					email,
					role: role.name,
					organization,
					registerUrl,
					originUrl,
					languageCode,
					invitedByUser
				});
			} else if (inviteType === InvitationTypeEnum.EMPLOYEE || inviteType === InvitationTypeEnum.CANDIDATE) {
				this.emailService.inviteEmployee({
					email,
					registerUrl,
					originUrl,
					organization,
					languageCode,
					invitedByUser
				});
			} else if (inviteType === InvitationTypeEnum.TEAM) {
				let inviteLink: string;
				if (callbackUrl) {
					inviteLink = `${callbackUrl}?email=${encodeURIComponent(email)}&code=${code}`;
				} else {
					inviteLink = `${registerUrl}`;
				}
				this.emailService.inviteTeamMember({
					email: email,
					inviteCode: code,
					teams: teams.map((team: IOrganizationTeam) => team.name).join(', '),
					languageCode,
					invitedByUser,
					organization,
					inviteLink,
					originUrl
				});
			}

			return await super.update(inviteId, { status: InviteStatusEnum.INVITED, invitedByUserId, token, code });
		} catch (error) {
			return error;
		}
	}

	/**
	 * Sends an acceptance invitation email to all super admin users of the given organization.
	 *
	 * @param organization - The organization details.
	 * @param employee - The employee who accepted the invitation.
	 * @param languageCode - The language code for the email.
	 * @returns A promise that resolves when all emails have been sent.
	 */
	async sendAcceptInvitationEmail(
		organization: IOrganization,
		employee: IEmployee,
		languageCode: LanguagesEnum
	): Promise<void> {
		try {
			const superAdminUsers: IUser[] = await this.userService.getAdminUsers(organization.tenantId);

			if (!superAdminUsers.length) {
				console.warn(`No super admin users found for tenant ${organization.tenantId}`);
				return;
			}

			// Send emails concurrently to all super admin users.
			await Promise.all(
				superAdminUsers.map(async (superAdmin) =>
					this.emailService.sendAcceptInvitationEmail({
						email: superAdmin.email,
						employee,
						organization,
						languageCode
					})
				)
			);
		} catch (error: any) {
			console.error(`Error sending accept invitation email: ${error.message}`, error);
			throw new Error(`Error sending accept invitation email: ${error.message}`);
		}
	}

	/**
	 * Creates an invite for an organization contact and sends an invitation email.
	 *
	 * @param input - The invitation input containing email, role, organization contact,
	 *                organization, and inviter details.
	 * @returns A promise that resolves with the created invite.
	 */
	async createOrganizationContactInvite(input: ICreateOrganizationContactInviteInput): Promise<Invite> {
		const { emailId, roleId, organizationContactId, organizationId, invitedByUserId, originalUrl, languageCode } =
			input;

		// Fetch organization contact, organization, and inviting user concurrently.
		const [organizationContact, organization, invitedByUser] = await Promise.all([
			this.organizationContactService.findOneByIdString(organizationContactId),
			this.organizationService.findOneByIdString(organizationId),
			this.userService.findOneByIdString(invitedByUserId)
		]);

		// Determine the invite expiry period (use default if not provided).
		const inviteExpiryPeriod = organization?.inviteExpiryPeriod ?? DEFAULT_INVITE_EXPIRY_PERIOD;
		const expireDate = addDays(new Date(), inviteExpiryPeriod);

		// Create and populate the invite object.
		const invite = new Invite();
		invite.token = this.createToken(emailId);
		invite.email = emailId;
		invite.roleId = roleId;
		invite.organizationId = organizationId;
		invite.tenantId = RequestContext.currentTenantId();
		invite.invitedByUserId = invitedByUserId;
		invite.status = InviteStatusEnum.INVITED;
		invite.expireDate = expireDate;
		invite.organizationContacts = [organizationContact];

		// Save the invite to the repository.
		const createdInvite = await this.typeOrmRepository.save(invite);

		// Send the invitation email (fire-and-forget).
		this.emailService.inviteOrganizationContact(
			organizationContact,
			invitedByUser,
			organization,
			createdInvite,
			languageCode,
			originalUrl
		);

		return createdInvite;
	}

	/**
	 * Check, if invite exist or expired for user
	 * Validate invited by token
	 *
	 * @param where
	 * @returns
	 */
	async validateByToken(where: FindOptionsWhere<Invite>): Promise<IInvite> {
		try {
			const { email, token } = where;
			const payload: string | JwtPayload = verify(token as string, environment.JWT_SECRET);

			if (typeof payload === 'object' && 'email' in payload) {
				if (payload.email === email) {
					const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
					query.setFindOptions({
						select: {
							id: true,
							email: true,
							fullName: true,
							organization: {
								name: true
							}
						},
						relations: {
							organization: true
						}
					});
					query.where((qb: SelectQueryBuilder<Invite>) => {
						qb.andWhere({
							email,
							token,
							status: InviteStatusEnum.INVITED,
							...(payload['code']
								? {
										code: payload['code']
								  }
								: {})
						});
						qb.andWhere([
							{
								expireDate: MoreThanOrEqual(new Date())
							},
							{
								expireDate: IsNull()
							}
						]);
					});
					return await query.getOneOrFail();
				}
			}
			throw new BadRequestException();
		} catch (error) {
			throw new BadRequestException();
		}
	}

	/**
	 * Validate invited by code
	 *
	 * @param where
	 * @returns
	 */
	async validateByCode(where: FindOptionsWhere<Invite>): Promise<IInvite> {
		const { email, code } = where;

		try {
			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			query.setFindOptions({
				select: {
					id: true,
					email: true,
					fullName: true,
					organization: {
						name: true
					}
				},
				relations: {
					organization: true
				}
			});
			query.where((qb: SelectQueryBuilder<Invite>) => {
				qb.andWhere({
					email,
					code,
					status: InviteStatusEnum.INVITED
				});
				qb.andWhere([
					{
						expireDate: MoreThanOrEqual(new Date())
					},
					{
						expireDate: IsNull()
					}
				]);
			});
			return await query.getOneOrFail();
		} catch (error) {
			console.error(`Cant validate code '${code}' for email '${email}'`, error);
			throw new BadRequestException();
		}
	}

	createToken(email: string): string {
		const token: string = sign({ email }, environment.JWT_SECRET, {});
		return token;
	}

	/**
	 * Find All Invites Using Pagination
	 *
	 * @param options
	 * @returns
	 */
	public async findAllInvites(options: BaseQueryDTO<any>) {
		try {
			return await super.findAll({
				...(options && options.skip
					? {
							skip: options.take * (options.skip - 1)
					  }
					: {}),
				...(options && options.take
					? {
							take: options.take
					  }
					: {}),
				...(options && options.relations
					? {
							relations: options.relations
					  }
					: {}),
				where: {
					tenantId: RequestContext.currentTenantId(),
					...(isNotEmpty(options) && isNotEmpty(options.where) ? options.where : {}),
					...(isNotEmpty(options) && isNotEmpty(options.where)
						? isNotEmpty(options.where.role)
							? {
									role: {
										...options.where.role
									}
							  }
							: {
									role: {
										name: Not(RolesEnum.EMPLOYEE)
									}
							  }
						: {}),
					/**
					 * Organization invites filter by specific projects
					 */
					...(isNotEmpty(options) && isNotEmpty(options.where)
						? isNotEmpty(options.where.projects)
							? {
									projects: {
										id: In(options.where.projects.id)
									}
							  }
							: {}
						: {}),
					/**
					 * Organization invites filter by specific teams
					 */
					...(isNotEmpty(options) && isNotEmpty(options.where)
						? isNotEmpty(options.where.teams)
							? {
									teams: {
										id: In(options.where.teams.id)
									}
							  }
							: {}
						: {})
				}
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Finds invites associated with the current user.
	 * Retrieves invite items and total count based on the current user's email, status, and expiry date.
	 * Supports different ORMs (Object-Relational Mappers): MikroORM and TypeORM.
	 *
	 * @returns An object containing an array of invite items and the total count of invites.
	 */
	async getCurrentUserInvites(): Promise<IPagination<IInvite>> {
		try {
			let total: number;
			let items: Invite[] = [];

			const user = RequestContext.currentUser();

			// Define common parameters for querying
			const options: FindManyOptions<Invite> = {
				select: {
					id: true,
					expireDate: true,
					teams: {
						id: true,
						name: true
					}
				},
				where: [
					{
						email: user.email,
						status: InviteStatusEnum.INVITED,
						expireDate: MoreThanOrEqual(new Date()),
						isActive: true,
						isArchived: false
					},
					{
						email: user.email,
						status: InviteStatusEnum.INVITED,
						expireDate: IsNull(),
						isActive: true,
						isArchived: false
					}
				],
				relations: { teams: true }
			};

			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					const { where, mikroOptions } = parseTypeORMFindToMikroOrm<Invite>(options as FindManyOptions);
					[items, total] = (await this.mikroOrmInviteRepository.findAndCount(where, mikroOptions)) as any;
					items = items.map((entity) => this.serialize(entity)) as Invite[];
					break;
				case MultiORMEnum.TypeORM:
					[items, total] = await this.typeOrmInviteRepository.findAndCount(options);
					break;
				default:
					throw new Error(`Not implemented for ${this.ormType}`);
			}

			return { items, total };
		} catch (error) {
			// Handle the error here, e.g., logging, returning an error response, etc.
			console.error('An error occurred in get current user invites:', error);
			throw new BadRequestException(error); // Re-throwing the error for higher-level handling if needed
		}
	}

	/**
	 * Handle the response to an invitation action.
	 *
	 * @param id The ID of the invitation.
	 * @param action The action to be performed (accept or reject).
	 * @param origin The origin from which the request originated.
	 * @param languageCode The language code for localization.
	 * @returns A promise that resolves to the updated invitation.
	 */
	async handleInvitationResponse(
		id: ID,
		action: InviteActionEnum,
		origin: string,
		languageCode: LanguagesEnum
	): Promise<IInvite> {
		try {
			const user = RequestContext.currentUser();
			const currentTenantId = RequestContext.currentTenantId();

			const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
			query.setFindOptions({
				select: {
					id: true,
					code: true,
					token: true,
					email: true,
					fullName: true,
					organizationId: true,
					invitedByUserId: true,
					tenantId: true,
					teams: {
						id: true,
						name: true
					}
				},
				relations: {
					teams: true,
					tenant: true,
					role: true
				}
			});
			query.where((qb: SelectQueryBuilder<Invite>) => {
				qb.andWhere({
					id,
					email: user.email,
					status: InviteStatusEnum.INVITED
				});
				qb.andWhere([
					{
						expireDate: MoreThanOrEqual(new Date())
					},
					{
						expireDate: IsNull()
					}
				]);
			});
			const invitation = await query.getOne();
			if (!invitation) {
				throw new NotFoundException('You do not have any invitation.');
			}

			const {
				fullName,
				email,
				tenant,
				tenantId,
				role,
				organizationId,
				invitedByUserId,
				id: inviteId,
				token,
				code,
				teams
			} = invitation;

			let invitedTenantUser: IUser;

			if (currentTenantId !== tenantId) {
				invitedTenantUser = await this.typeOrmUserRepository.findOne({
					where: { email, tenantId },
					relations: { tenant: true, role: true }
				});
			}

			/**
			 * ACCEPTED
			 */
			if (action === InviteActionEnum.ACCEPTED) {
				/**
				 * Accepted Case - 1
				 * Current user is belong to invited tenant
				 */
				if (user.tenantId === tenantId) {
					await this.commandBus.execute(
						new InviteAcceptCommand(
							{
								user,
								email,
								token,
								code,
								originalUrl: origin
							},
							languageCode
						)
					);
				}

				/**
				 * Accepted Case - 2
				 * Current user is already part of invited tenant as separate user
				 */
				if (invitedTenantUser) {
					const employee = await this.typeOrmEmployeeRepository.findOneOrFail({
						where: {
							userId: invitedTenantUser.id
						}
					});
					if (employee) {
						const [team] = teams;
						/**
						 * Add employee to invited team
						 */
						await this.typeOrmOrganizationTeamEmployeeRepository.save({
							employeeId: employee.id,
							organizationTeamId: team.id,
							roleId: invitedTenantUser.roleId,
							tenantId,
							organizationId
						});

						await this.typeOrmRepository.update(inviteId, {
							status: InviteStatusEnum.ACCEPTED,
							userId: invitedTenantUser.id
						});
					}
				}

				/**
				 * Accepted Case - 3
				 * Current user is not belong to invited tenant & current user email with invited tenant is not present
				 */
				if (user.tenantId !== tenantId && !invitedTenantUser) {
					const [team] = teams;
					const names = fullName?.split(' ');
					const newTenantUser = await this.createUser(
						{
							user: {
								firstName: (names && names.length && names[0]) || '',
								lastName: (names && names.length && names[1]) || '',
								email: email,
								tenant: tenant,
								role: role
							},
							organizationId,
							inviteId,
							createdByUserId: invitedByUserId
						},
						team.id,
						languageCode
					);
					await this.typeOrmRepository.update(inviteId, {
						status: InviteStatusEnum.ACCEPTED,
						userId: newTenantUser.id
					});
				}
			}

			/**
			 * REJECTED
			 */
			if (action === InviteActionEnum.REJECTED) {
				await this.typeOrmRepository.update(id, {
					status: InviteStatusEnum.REJECTED
				});
			}

			return await this.typeOrmRepository.findOne({
				where: { id },
				select: { status: true }
			});
		} catch (error) {
			// Handle the error here, e.g., logging, returning an error response, etc.
			console.error('An error occurred when accept invitation by ID:', error);
			throw new BadRequestException(error);
		}
	}

	/**
	 * Create a new user.
	 *
	 * @param input The input data for user registration and integration configuration.
	 * @param organizationTeamId The ID of the organization team to associate the user with.
	 * @param languageCode The language code for localization.
	 * @returns A promise that resolves to the created user.
	 */
	async createUser(
		input: IUserRegistrationInput & Partial<IAppIntegrationConfig>,
		organizationTeamId: ID,
		languageCode: LanguagesEnum
	): Promise<IUser> {
		let tenant = input.user.tenant;

		if (input.createdByUserId) {
			const creatingUser = await this.typeOrmUserRepository.findOneOrFail({
				where: { id: input.createdByUserId },
				relations: { tenant: true }
			});
			tenant = creatingUser.tenant;
		}

		/**
		 * Register new user
		 */
		const create = this.typeOrmUserRepository.create({
			...input.user,
			tenant,
			...(input.password ? { hash: await this.authService.getPasswordHash(input.password) } : {})
		});
		const entity = await this.typeOrmUserRepository.save(create);

		/**
		 * Email automatically verified after accept invitation
		 */
		await this.typeOrmUserRepository.update(entity.id, {
			...(input.inviteId ? { emailVerifiedAt: freshTimestamp() } : {})
		});

		/**
		 * Find latest register user with role
		 */
		const user = await this.typeOrmUserRepository.findOne({
			where: { id: entity.id },
			relations: { role: true }
		});

		if (input.organizationId) {
			/**
			 * Add user to invited Organization
			 */
			await this.userOrganizationService.addUserToOrganization(user, input.organizationId);

			/**
			 * Create employee associated to invited organization and tenant
			 */
			const employee = await this.typeOrmEmployeeRepository.save({
				organizationId: input.organizationId,
				tenantId: tenant.id,
				userId: user.id,
				startedWorkOn: freshTimestamp()
			});

			/**
			 * Add employee to invited team
			 */
			await this.typeOrmOrganizationTeamEmployeeRepository.save({
				employeeId: employee.id,
				organizationTeamId,
				tenantId: user.tenantId,
				organizationId: input.organizationId,
				roleId: user.roleId
			});
		}

		// Extract integration information
		let integration = pick(input, ['appName', 'appLogo', 'appSignature', 'appLink', 'companyLink', 'companyName']);

		this.emailService.welcomeUser(input.user, languageCode, input.organizationId, input.originalUrl, integration);
		return user;
	}
}
