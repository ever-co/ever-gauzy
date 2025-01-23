import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { JwtPayload, sign, verify } from 'jsonwebtoken';
import { FindManyOptions, FindOptionsWhere, In, IsNull, MoreThanOrEqual, Not, SelectQueryBuilder } from 'typeorm';
import { addDays } from 'date-fns';
import { pick } from 'underscore';
import { ConfigService, environment } from '@gauzy/config';
import {
	ICreateEmailInvitesInput,
	ICreateEmailInvitesOutput,
	InviteStatusEnum,
	IOrganizationContact,
	IUser,
	ICreateOrganizationContactInviteInput,
	RolesEnum,
	LanguagesEnum,
	DEFAULT_INVITE_EXPIRY_PERIOD,
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
	IPagination
} from '@gauzy/contracts';
import { IAppIntegrationConfig } from '@gauzy/common';
import { isNotEmpty } from '@gauzy/utils';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { ALPHA_NUMERIC_CODE_LENGTH } from './../constants';
import { RequestContext } from './../core/context';
import {
	MultiORMEnum,
	freshTimestamp,
	generateRandomAlphaNumericCode,
	getArrayIntersection,
	parseTypeORMFindToMikroOrm
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
import { User } from './../user/user.entity';
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
	 * Creates all invites. If an email Id already exists, this function will first delete
	 * the existing invite and then create a new row with the email address.
	 * @param emailInvites Emails Ids to send invite
	 */
	async createBulk(input: ICreateEmailInvitesInput, languageCode: LanguagesEnum): Promise<ICreateEmailInvitesOutput> {
		const originUrl = this.configService.get('clientBaseUrl') as string;
		const tenantId = RequestContext.currentTenantId() || input.tenantId;
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

		const organizationProjectsPromise = this.organizationProjectService.find({
			where: { id: In(projectIds || []), organizationId, tenantId }
		});
		const organizationDepartmentsPromise = this.organizationDepartmentService.find({
			where: { id: In(departmentIds || []), organizationId, tenantId }
		});
		const organizationContactsPromise = this.organizationContactService.find({
			where: { id: In(organizationContactIds || []), organizationId, tenantId }
		});
		const organizationTeamsPromise = this.organizationTeamService.find({
			where: { id: In(teamIds || []), organizationId, tenantId }
		});

		const promisesAll = await Promise.all([
			organizationProjectsPromise,
			organizationDepartmentsPromise,
			organizationContactsPromise,
			organizationTeamsPromise
		]);
		const [organizationProjects, organizationDepartments, organizationContacts, organizationTeams] = promisesAll;

		// Invited User
		const invitedById = RequestContext.currentUserId();
		const invitedBy: IUser = await this.userService.findOneByIdString(invitedById, {
			relations: { role: true }
		});

		// Invited Organization
		const organization: IOrganization = await this.organizationService.findOneByIdString(organizationId);

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

			// Handle unauthorized access if the invitedBy user is not a 'SUPER_ADMIN'
			if (role.name === RolesEnum.SUPER_ADMIN && invitedBy.role.name !== RolesEnum.SUPER_ADMIN) {
				throw new UnauthorizedException();
			}
		}

		let expireDate: Date | null;
		if (invitationExpirationPeriod === InvitationExpirationEnum.NEVER) {
			expireDate = null;
		} else {
			const inviteExpiryPeriod = invitationExpirationPeriod || organization.inviteExpiryPeriod;
			expireDate = addDays(new Date(), (inviteExpiryPeriod as number) || DEFAULT_INVITE_EXPIRY_PERIOD);
		}

		// already existed invites
		const { items: existedInvites } = await this.findAll({
			...(isNotEmpty(teamIds) ? { relations: { teams: true } } : {}),
			where: {
				tenantId,
				...(isNotEmpty(organizationId) ? { organizationId } : {}),
				...(isNotEmpty(emailIds) ? { email: In(emailIds) } : {})
			}
		});

		let ignoreInvites = 0;
		const invites: Invite[] = [];
		for await (const email of emailIds) {
			let alreadyInTeamIds: string[] = [];
			const code = generateRandomAlphaNumericCode(6);
			const token: string = sign({ email, code }, environment.JWT_SECRET, {});

			const organizationTeamEmployees = await this.typeOrmOrganizationTeamEmployeeRepository.find({
				where: {
					employee: { user: { email } },
					organizationTeamId: In(teamIds)
				}
			});
			if (organizationTeamEmployees.length > 0) {
				alreadyInTeamIds = organizationTeamEmployees.map(
					(organizationTeamEmployee) => organizationTeamEmployee.organizationTeamId
				);
			}

			const matchedInvites = existedInvites.filter(
				(invite: IInvite) =>
					invite.email === email &&
					getArrayIntersection(invite.teams?.map((team: IOrganizationTeam) => team.id) || [], teamIds)
						.length > 0
			);

			if (isNotEmpty(matchedInvites)) {
				const needsToInviteTeams = organizationTeams.filter(
					(team: IOrganizationTeam) =>
						!alreadyInTeamIds.includes(team.id) &&
						matchedInvites.every((invite) => invite.status !== InviteStatusEnum.INVITED)
				);
				if (isNotEmpty(needsToInviteTeams)) {
					invites.push(
						new Invite({
							token,
							email,
							roleId,
							organizationId,
							invitedById,
							tenantId,
							status: InviteStatusEnum.INVITED,
							expireDate,
							projects: organizationProjects,
							teams: needsToInviteTeams,
							departments: organizationDepartments,
							organizationContacts,
							actionDate: startedWorkOn || appliedDate,
							code,
							fullName
						})
					);
				} else {
					ignoreInvites++;
				}
			} else {
				invites.push(
					new Invite({
						token,
						email,
						roleId,
						organizationId,
						tenantId: RequestContext.currentTenantId(),
						invitedById: RequestContext.currentUserId(),
						status: InviteStatusEnum.INVITED,
						expireDate,
						projects: organizationProjects,
						teams: organizationTeams,
						departments: organizationDepartments,
						organizationContacts,
						actionDate: startedWorkOn || appliedDate,
						code,
						fullName
					})
				);
			}
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
						organization: organization,
						registerUrl: inviteLink,
						originUrl,
						languageCode,
						invitedBy
					});
					break;

				case InvitationTypeEnum.EMPLOYEE:
				case InvitationTypeEnum.CANDIDATE:
					this.emailService.inviteEmployee({
						email: item.email,
						registerUrl: inviteLink,
						organizationContacts,
						departments: organizationDepartments,
						originUrl,
						organization: organization,
						languageCode,
						invitedBy
					});
					break;

				case InvitationTypeEnum.TEAM:
					this.emailService.inviteTeamMember({
						email: item.email,
						teams: item.teams.map((team: IOrganizationTeam) => team.name).join(', '),
						languageCode,
						invitedBy,
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

	async resendEmail(input: IInviteResendInput, languageCode: LanguagesEnum) {
		const originUrl = this.configService.get('clientBaseUrl') as string;
		const { inviteId, inviteType, callbackUrl } = input;
		/**
		 * Invitation
		 */
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
		 * Invited by the user
		 */
		const invitedBy: IUser = await this.userService.findOneByIdString(RequestContext.currentUserId());
		try {
			const code = generateRandomAlphaNumericCode(ALPHA_NUMERIC_CODE_LENGTH);
			const token: string = sign({ email, code }, environment.JWT_SECRET, {});

			const registerUrl = `${originUrl}/#/auth/accept-invite?email=${encodeURIComponent(email)}&token=${token}`;
			if (inviteType === InvitationTypeEnum.USER) {
				this.emailService.inviteUser({
					email,
					role: role.name,
					organization,
					registerUrl,
					originUrl,
					languageCode,
					invitedBy
				});
			} else if (inviteType === InvitationTypeEnum.EMPLOYEE || inviteType === InvitationTypeEnum.CANDIDATE) {
				this.emailService.inviteEmployee({
					email,
					registerUrl,
					originUrl,
					organization,
					languageCode,
					invitedBy
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
					invitedBy,
					organization,
					inviteLink,
					originUrl
				});
			}

			return await this.update(inviteId, {
				status: InviteStatusEnum.INVITED,
				invitedById: RequestContext.currentUserId(),
				token,
				code
			});
		} catch (error) {
			return error;
		}
	}

	async sendAcceptInvitationEmail(
		organization: IOrganization,
		employee: IEmployee,
		languageCode: LanguagesEnum
	): Promise<any> {
		const superAdminUsers: IUser[] = await this.userService.getAdminUsers(organization.tenantId);

		try {
			for await (const superAdmin of superAdminUsers) {
				this.emailService.sendAcceptInvitationEmail({
					email: superAdmin.email,
					employee,
					organization,
					languageCode
				});
			}
		} catch (e) {
			console.log('caught', e);
		}
	}

	async createOrganizationContactInvite(inviteInput: ICreateOrganizationContactInviteInput): Promise<Invite> {
		const { emailId, roleId, organizationContactId, organizationId, invitedById, originalUrl, languageCode } =
			inviteInput;
		const organizationContact: IOrganizationContact = await this.organizationContactService.findOneByIdString(
			organizationContactId
		);
		const organization: IOrganization = await this.organizationService.findOneByIdString(organizationId);
		const inviterUser: IUser = await this.userService.findOneByIdString(invitedById);

		const inviteExpiryPeriod =
			organization && organization.inviteExpiryPeriod
				? organization.inviteExpiryPeriod
				: DEFAULT_INVITE_EXPIRY_PERIOD;

		const expireDate = addDays(new Date(), inviteExpiryPeriod);

		const invite = new Invite();
		invite.token = this.createToken(emailId);
		invite.email = emailId;
		invite.roleId = roleId;
		invite.organizationId = organizationId;
		invite.tenantId = RequestContext.currentTenantId();
		invite.invitedById = invitedById;
		invite.status = InviteStatusEnum.INVITED;
		invite.expireDate = expireDate;
		invite.organizationContacts = [organizationContact];

		const createdInvite = await this.typeOrmRepository.save(invite);

		this.emailService.inviteOrganizationContact(
			organizationContact,
			inviterUser,
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
	public async findAllInvites(options: PaginationParams<any>) {
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
		id: string,
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
					invitedById: true,
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
				invitedById,
				id: inviteId,
				token,
				code,
				teams
			} = invitation;

			let invitedTenantUser: User;

			if (currentTenantId !== tenantId) {
				invitedTenantUser = await this.typeOrmUserRepository.findOne({
					where: { email, tenantId },
					relations: {
						tenant: true,
						role: true
					}
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
							createdById: invitedById
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
		organizationTeamId: string,
		languageCode: LanguagesEnum
	): Promise<User> {
		let tenant = input.user.tenant;

		if (input.createdById) {
			const creatingUser = await this.typeOrmUserRepository.findOneOrFail({
				where: { id: input.createdById },
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
