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
	IInviteResendInput
} from '@gauzy/contracts';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtPayload, sign, verify } from 'jsonwebtoken';
import {
	FindOptionsWhere,
	In,
	IsNull,
	MoreThanOrEqual,
	Not,
	Repository,
	SelectQueryBuilder
} from 'typeorm';
import { addDays } from 'date-fns';
import { isNotEmpty } from '@gauzy/common';
import { PaginationParams, TenantAwareCrudService } from './../core/crud';
import { RequestContext } from './../core/context';
import { generateRandomInteger } from './../core/utils';
import { Invite } from './invite.entity';
import { EmailService } from '../email/email.service';
import { UserService } from '../user/user.service';
import { RoleService } from './../role/role.service';
import { OrganizationService } from './../organization/organization.service';
import { OrganizationTeamService } from './../organization-team/organization-team.service';
import { OrganizationDepartmentService } from './../organization-department/organization-department.service';
import { OrganizationContactService } from './../organization-contact/organization-contact.service';
import { OrganizationProjectService } from './../organization-project/organization-project.service';

@Injectable()
export class InviteService extends TenantAwareCrudService<Invite> {
	constructor(
		@InjectRepository(Invite)
		protected readonly inviteRepository: Repository<Invite>,

		private readonly configSerice: ConfigService,
		private readonly emailService: EmailService,
		private readonly organizationContactService: OrganizationContactService,
		private readonly organizationDepartmentService: OrganizationDepartmentService,
		private readonly organizationProjectService: OrganizationProjectService,
		private readonly organizationService: OrganizationService,
		private readonly organizationTeamService: OrganizationTeamService,
		private readonly roleService: RoleService,
		private readonly userService: UserService,
	) {
		super(inviteRepository);
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
		const originUrl = this.configSerice.get('clientBaseUrl') as string;
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
		const role: IRole = await this.roleService.findOneByIdString(roleId);
		if (role.name === RolesEnum.SUPER_ADMIN) {
			if (invitedBy.role.name !== RolesEnum.SUPER_ADMIN) {
				throw new UnauthorizedException();
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
				const inviteExpiryPeriod = (organization.inviteExpiryPeriod) || DEFAULT_INVITE_EXPIRY_PERIOD;
				expireDate = addDays(new Date(), inviteExpiryPeriod as number);
			}
		}

		// already existed invites
		const { items: existedInvites } = await this.findAll({
			...(isNotEmpty(teamIds)) ? {
				relations: {
					teams: true
				}
			} : {},
			where: {
				tenantId: RequestContext.currentTenantId(),
				...(
					(isNotEmpty(organizationId)) ? {
						organizationId
					} : {}
				),
				...(
					(isNotEmpty(emailIds)) ? {
						email: In(emailIds)
					} : {}
				),
			}
		});

		let ignoreInvites = 0;
		const invites: Invite[] = [];
		for await (const email of emailIds) {
			const code = generateRandomInteger(6);
			const token: string = sign({ email, code }, environment.JWT_SECRET, {});

			const matchedInvites = existedInvites.filter(
				(invite: IInvite) => (invite.email === email)
			);
			if (isNotEmpty(matchedInvites)) {
				const existedTeams: IOrganizationTeam[] = [];
				for (const invite of matchedInvites) {
					if (isNotEmpty(invite.teams)) {
						existedTeams.push(...invite.teams);
					}
				}
				const needsToInviteTeams = organizationTeams.filter(
					(item: IOrganizationTeam) => !existedTeams.some(
						(team: IOrganizationTeam) => team.id === item.id
					)
				);
				if (isNotEmpty(needsToInviteTeams)) {
					invites.push(new Invite({
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
						departments:organizationDepartments,
						organizationContacts,
						actionDate: startedWorkOn || appliedDate,
						code,
						fullName
					}));
				} else {
					ignoreInvites++;
				}
			} else {
				invites.push(new Invite({
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
					departments:organizationDepartments,
					organizationContacts,
					actionDate: startedWorkOn || appliedDate,
					code,
					fullName
				}));
			}
		}
		const items = await this.repository.save(invites);
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
			} else if (emailInvites.inviteType === InvitationTypeEnum.EMPLOYEE) {
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
					inviteLink = `${callbackUrl}?email=${item.email}&code=${item.code}`
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

	async resendEmail(
		input: IInviteResendInput,
		languageCode: LanguagesEnum
	) {
		const originUrl = this.configSerice.get('clientBaseUrl') as string;
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
		const invitedBy: IUser = await this.userService.findOneByIdString(
			RequestContext.currentUserId()
		);
		try{
			const code = generateRandomInteger(6);
			const token: string = sign({ email, code }, environment.JWT_SECRET, {});

			const registerUrl = `${originUrl}/#/auth/accept-invite?email=${email}&token=${token}`;
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
					inviteLink = `${callbackUrl}?email=${email}&code=${code}`
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
		} catch(error){
			return error
		}
	}

	async sendAcceptInvitationEmail(
		organization: IOrganization,
		employee: IEmployee,
		languageCode: LanguagesEnum
	): Promise<any>
	{
		const superAdminUsers: IUser[] = await this.userService.getAdminUsers(organization.tenantId);

		try {
			for await (const superAdmin of superAdminUsers) {
				this.emailService.sendAcceptInvitationEmail({
					email: superAdmin.email,
					employee,
					organization,
					languageCode,
				});
			}
		} catch (e) {
			console.log('caught', e)
		}
	}

	async createOrganizationContactInvite(
		inviteInput: ICreateOrganizationContactInviteInput
	): Promise<Invite> {
		const {
			emailId,
			roleId,
			organizationContactId,
			organizationId,
			invitedById,
			originalUrl,
			languageCode
		} = inviteInput;
		const organizationContact: IOrganizationContact = await this.organizationContactService.findOneByIdString(
			organizationContactId
		);
		const organization: IOrganization = await this.organizationService.findOneByIdString(
			organizationId
		);
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

		const createdInvite = await this.repository.save(invite);

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
	 *
	 * @param where
	 * @returns
	 */
	async validate(
		where: FindOptionsWhere<Invite>
	): Promise<IInvite> {
		try {
			const { email, token } = where;
			const payload: string | JwtPayload = verify(token as string, environment.JWT_SECRET);

			if (typeof payload === 'object' && 'email' in payload) {
				if (payload.email === email) {
					const query = this.repository.createQueryBuilder(this.alias);
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
							...(
								(payload['code']) ? {
									code: payload['code']
								} : {}
							),
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
	async validateByCode(
		where: FindOptionsWhere<Invite>
	): Promise<IInvite> {
		try {
			const { email, code } = where;
			const query = this.repository.createQueryBuilder(this.alias);
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
				...(
					(options && options.skip) ? {
						skip: (options.take * (options.skip - 1))
					} : {}
				),
				...(
					(options && options.take) ? {
						take: (options.take)
					} : {}
				),
				...(
					(options && options.relations) ? {
						relations: options.relations
					} : {}
				),
				where: {
					tenantId: RequestContext.currentTenantId(),
					...(
						(options && isNotEmpty(options.where)) ? {
							organizationId: options.where.organizationId
						} : {}
					),
					...(
						(isNotEmpty(options) && isNotEmpty(options.where)) ?
							(isNotEmpty(options.where.role)) ? {
								role: {
									...options.where.role
								}
							} : {
								role: {
									name: Not(RolesEnum.EMPLOYEE)
								}
							}
						: {}
					),
					/**
					 * Organization invites filter by specific projects
					 */
					 ...(
						(isNotEmpty(options) && isNotEmpty(options.where)) ?
							(isNotEmpty(options.where.projects)) ? {
								projects: {
									id: In(options.where.projects.id)
								}
							} : {}
						: {}
					),
					/**
					 * Organization invites filter by specific teams
					 */
					...(
						(isNotEmpty(options) && isNotEmpty(options.where)) ?
							(isNotEmpty(options.where.teams)) ? {
								teams: {
									id: In(options.where.teams.id)
								}
							} : {}
						: {}
					),
				}
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
