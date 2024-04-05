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
	IOrganizationProject,
	IOrganizationContact,
	IOrganizationDepartment,
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
	IUserRegistrationInput
} from '@gauzy/contracts';
import { IAppIntegrationConfig, isNotEmpty } from '@gauzy/common';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { ALPHA_NUMERIC_CODE_LENGTH } from './../constants';
import { RequestContext } from './../core/context';
import { MultiORMEnum, findIntersection, freshTimestamp, generateRandomAlphaNumericCode, parseTypeORMFindToMikroOrm } from './../core/utils';
import { EmailService } from './../email-send/email.service';
import { UserService } from '../user/user.service';
import { EmployeeService } from '../employee/employee.service';
import { RoleService } from './../role/role.service';
import { OrganizationService } from './../organization/organization.service';
import { OrganizationTeamService } from './../organization-team/organization-team.service';
import { OrganizationDepartmentService } from './../organization-department/organization-department.service';
import { OrganizationContactService } from './../organization-contact/organization-contact.service';
import { OrganizationProjectService } from './../organization-project/organization-project.service';
import { AuthService } from './../auth/auth.service';
import { User } from './../user/user.entity';
import { UserOrganizationService } from './../user-organization/user-organization.services';
import { MikroOrmUserRepository, TypeOrmUserRepository } from '../user/repository';
import { MikroOrmEmployeeRepository, TypeOrmEmployeeRepository } from '../employee/repository';
import { MikroOrmOrganizationTeamEmployeeRepository, TypeOrmOrganizationTeamEmployeeRepository } from '../organization-team-employee/repository';
import { MikroOrmInviteRepository, TypeOrmInviteRepository } from './repository';
import { Invite } from './invite.entity';
import { InviteAcceptCommand } from './commands';

@Injectable()
export class InviteService extends TenantAwareCrudService<Invite> {
	constructor(
		readonly typeOrmInviteRepository: TypeOrmInviteRepository,
		readonly mikroOrmInviteRepository: MikroOrmInviteRepository,
		readonly typeOrmUserRepository: TypeOrmUserRepository,
		readonly mikroOrmUserRepository: MikroOrmUserRepository,
		readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository,
		readonly typeOrmOrganizationTeamEmployeeRepository: TypeOrmOrganizationTeamEmployeeRepository,
		readonly mikroOrmOrganizationTeamEmployeeRepository: MikroOrmOrganizationTeamEmployeeRepository,
		private readonly configService: ConfigService,
		private readonly emailService: EmailService,
		private readonly employeeService: EmployeeService,
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
	async createBulk(
		emailInvites: ICreateEmailInvitesInput,
		languageCode: LanguagesEnum
	): Promise<ICreateEmailInvitesOutput> {
		const originUrl = this.configService.get('clientBaseUrl') as string;
		const {
			emailIds,
			roleId,
			projectIds,
			organizationContactIds,
			departmentIds,
			teamIds,
			organizationId,
			startedWorkOn,
			appliedDate,
			invitationExpirationPeriod,
			fullName,
			callbackUrl
		} = emailInvites;

		const organizationProjects: IOrganizationProject[] = await this.organizationProjectService.find({
			where: {
				id: In(projectIds || []),
				organizationId
			}
		});
		const organizationDepartments: IOrganizationDepartment[] = await this.organizationDepartmentService.find({
			where: {
				id: In(departmentIds || []),
				organizationId
			}
		});
		const organizationContacts: IOrganizationContact[] = await this.organizationContactService.find({
			where: {
				id: In(organizationContactIds || []),
				organizationId
			}
		});
		const organizationTeams: IOrganizationTeam[] = await this.organizationTeamService.find({
			where: {
				id: In(teamIds || []),
				organizationId
			}
		});

		/**
		 * Invited by the user
		 */
		const invitedBy: IUser = await this.userService.findOneByIdString(RequestContext.currentUserId(), {
			relations: {
				role: true
			}
		});
		/**
		 * Invited organization
		 */
		const organization: IOrganization = await this.organizationService.findOneByIdString(organizationId);
		/**
		 * Invited for role
		 */
		let role: IRole;
		try {
			// Employee can invite other user for employee role only
			role = await this.roleService.findOneByIdString(RequestContext.currentRoleId(), {
				where: {
					name: RolesEnum.EMPLOYEE
				}
			});
		} catch (error) {
			role = await this.roleService.findOneByIdString(roleId);
			if (role.name === RolesEnum.SUPER_ADMIN) {
				if (invitedBy.role.name !== RolesEnum.SUPER_ADMIN) {
					throw new UnauthorizedException();
				}
			}
		}

		let expireDate: any;
		if (invitationExpirationPeriod === InvitationExpirationEnum.NEVER) {
			expireDate = null;
		} else {
			if (invitationExpirationPeriod) {
				const inviteExpiryPeriod = invitationExpirationPeriod;
				expireDate = addDays(new Date(), inviteExpiryPeriod as number);
			} else {
				const inviteExpiryPeriod = organization.inviteExpiryPeriod || DEFAULT_INVITE_EXPIRY_PERIOD;
				expireDate = addDays(new Date(), inviteExpiryPeriod as number);
			}
		}

		// already existed invites
		const { items: existedInvites } = await this.findAll({
			...(isNotEmpty(teamIds)
				? {
					relations: {
						teams: true
					}
				}
				: {}),
			where: {
				tenantId: RequestContext.currentTenantId(),
				...(isNotEmpty(organizationId)
					? {
						organizationId
					}
					: {}),
				...(isNotEmpty(emailIds)
					? {
						email: In(emailIds)
					}
					: {})
			}
		});

		let ignoreInvites = 0;
		const invites: Invite[] = [];
		for await (const email of emailIds) {
			const organizationTeamEmployees = await this.typeOrmOrganizationTeamEmployeeRepository.find({
				where: {
					employee: {
						user: {
							email
						}
					},
					organizationTeamId: In(teamIds)
				}
			});
			const alreadyInTeamIds = organizationTeamEmployees.map(
				(organizationTeamEmployee) => organizationTeamEmployee.organizationTeamId
			);

			const code = generateRandomAlphaNumericCode(6);
			const token: string = sign({ email, code }, environment.JWT_SECRET, {});

			const matchedInvites = existedInvites.filter(
				(invite: IInvite) =>
					invite.email === email &&
					// Check is invitation is already having for team id from teamIds
					findIntersection(
						invite.teams.map((team) => team.id),
						teamIds
					).length > 0
			);
			if (isNotEmpty(matchedInvites)) {
				const needsToInviteTeams = organizationTeams.filter(
					(item: IOrganizationTeam) =>
						!alreadyInTeamIds.includes(item.id) &&
						matchedInvites.every((item) => item.status !== InviteStatusEnum.INVITED)
				);
				if (isNotEmpty(needsToInviteTeams)) {
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
		items.forEach((item) => {
			const registerUrl = `${originUrl}/#/auth/accept-invite?email=${item.email}&token=${item.token}`;
			if (emailInvites.inviteType === InvitationTypeEnum.USER) {
				this.emailService.inviteUser({
					email: item.email,
					role: role.name,
					organization: organization,
					registerUrl,
					originUrl,
					languageCode,
					invitedBy
				});
			} else if (
				emailInvites.inviteType === InvitationTypeEnum.EMPLOYEE ||
				emailInvites.inviteType === InvitationTypeEnum.CANDIDATE
			) {
				this.emailService.inviteEmployee({
					email: item.email,
					registerUrl,
					organizationContacts,
					departments: organizationDepartments,
					originUrl,
					organization: organization,
					languageCode,
					invitedBy
				});
			} else if (emailInvites.inviteType === InvitationTypeEnum.TEAM) {
				let inviteLink: string;
				if (callbackUrl) {
					inviteLink = `${callbackUrl}?email=${encodeURIComponent(item.email)}&code=${item.code}`;
				} else {
					inviteLink = `${registerUrl}`;
				}
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
			}
		});

		return { items, total: items.length, ignored: ignoreInvites };
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
	async findInviteOfCurrentUser() {
		try {
			let total: number;
			let items: Invite[] = [];

			const tenantId = RequestContext.currentTenantId();
			const user = RequestContext.currentUser();

			// Define common parameters for querying
			const options: FindManyOptions<Invite> = {
				select: {
					id: true,
					expireDate: true,
					teams: {
						name: true
					}
				},
				where: [
					{
						tenantId,
						email: user.email,
						status: InviteStatusEnum.INVITED,
						expireDate: MoreThanOrEqual(new Date()),
						isActive: true,
						isArchived: false
					},
					{
						tenantId,
						email: user.email,
						status: InviteStatusEnum.INVITED,
						expireDate: IsNull(),
						isActive: true,
						isArchived: false
					}
				],
				relations: {
					teams: true
				}
			}

			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					const { where, mikroOptions } = parseTypeORMFindToMikroOrm<Invite>(options as FindManyOptions);
					console.log(JSON.stringify({ where, mikroOptions }));
					[items, total] = await this.mikroOrmInviteRepository.findAndCount(where, mikroOptions) as any;
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
			console.error('An error occurred in findInviteOfCurrentUser:', error);
			throw error; // Re-throwing the error for higher-level handling if needed
		}
	}

	async acceptMyInvitation(id: string, action: InviteActionEnum, origin: string, languageCode: LanguagesEnum) {
		const user = RequestContext.currentUser();

		const query = this.typeOrmRepository.createQueryBuilder(this.tableName);
		query.innerJoin(`${query.alias}.teams`, 'teams');
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
		if (user.tenantId !== tenantId) {
			invitedTenantUser = await this.typeOrmUserRepository.findOne({
				where: {
					email,
					tenantId
				},
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
							token: token,
							code: code,
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
				const employee = await this.employeeService.findOneByOptions({
					where: {
						userId: invitedTenantUser.id
					}
				});

				if (employee) {
					/**
					 * Add employee to invited team
					 */

					await this.typeOrmOrganizationTeamEmployeeRepository.save({
						employeeId: employee.id,
						organizationTeamId: teams[0].id,
						tenantId,
						organizationId: organizationId,
						roleId: invitedTenantUser.roleId
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
					invitation.teams[0].id,
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
			await this.typeOrmRepository.update(inviteId, {
				status: InviteStatusEnum.REJECTED
			});
		}

		return this.typeOrmRepository.findOne({
			where: {
				id: inviteId
			},
			select: {
				status: true
			}
		});
	}

	async createUser(
		input: IUserRegistrationInput & Partial<IAppIntegrationConfig>,
		organizationTeamId: string,
		languageCode: LanguagesEnum
	): Promise<User> {
		let tenant = input.user.tenant;
		if (input.createdById) {
			const creatingUser = await this.typeOrmUserRepository.findOneOrFail({
				where: {
					id: input.createdById
				},
				relations: {
					tenant: true
				}
			});

			tenant = creatingUser.tenant;
		}

		/**
		 * Register new user
		 */
		const create = this.typeOrmUserRepository.create({
			...input.user,
			tenant,
			...(input.password
				? {
					hash: await this.authService.getPasswordHash(input.password)
				}
				: {})
		});
		const entity = await this.typeOrmUserRepository.save(create);

		/**
		 * Email automatically verified after accept invitation
		 */
		await this.typeOrmUserRepository.update(entity.id, {
			...(input.inviteId
				? {
					emailVerifiedAt: freshTimestamp()
				}
				: {})
		});

		/**
		 * Find latest register user with role
		 */
		const user = await this.typeOrmUserRepository.findOne({
			where: {
				id: entity.id
			},
			relations: {
				role: true
			}
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
