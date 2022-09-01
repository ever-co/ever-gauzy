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
	InvitationTypeEnum
} from '@gauzy/contracts';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { sign } from 'jsonwebtoken';
import {
	Brackets,
	FindOptionsWhere,
	In,
	IsNull,
	MoreThanOrEqual,
	Not,
	Repository,
	SelectQueryBuilder,
	WhereExpressionBuilder
} from 'typeorm';
import { isNotEmpty } from '@gauzy/common';
import { TenantAwareCrudService } from './../core/crud';
import { Invite } from './invite.entity';
import { EmailService } from '../email/email.service';
import { addDays } from 'date-fns';
import { UserService } from '../user/user.service';
import { RequestContext } from './../core/context';
import {
	Organization,
	OrganizationContact,
	OrganizationDepartment,
	OrganizationProject,
	Role,
} from './../core/entities/internal';

@Injectable()
export class InviteService extends TenantAwareCrudService<Invite> {
	constructor(
		@InjectRepository(Invite)
		private readonly inviteRepository: Repository<Invite>,

		@InjectRepository(OrganizationProject)
		private readonly organizationProjectsRepository: Repository<OrganizationProject>,

		@InjectRepository(OrganizationContact)
		private readonly organizationContactRepository: Repository<OrganizationContact>,

		@InjectRepository(OrganizationDepartment)
		private readonly organizationDepartmentRepository: Repository<OrganizationDepartment>,

		@InjectRepository(Organization)
		private readonly organizationRepository: Repository<Organization>,

		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>,

		private readonly emailService: EmailService,
		private readonly userService: UserService,
		private readonly configSerice: ConfigService
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
		const invites: Invite[] = [];
		const {
			emailIds,
			roleId,
			projectIds,
			organizationContactIds,
			departmentIds,
			organizationId,
			invitedById,
			startedWorkOn,
			appliedDate,
			invitationExpirationPeriod
		} = emailInvites;
		const originUrl = this.configSerice.get('clientBaseUrl') as string;

		const projects: IOrganizationProject[] = await this.organizationProjectsRepository.findBy({
			id: In(projectIds || [])
		});

		const departments: IOrganizationDepartment[] = await this.organizationDepartmentRepository.findBy({
			id: In(departmentIds || [])
		});

		const organizationContacts: IOrganizationContact[] = await this.organizationContactRepository.findBy({
			id: In(organizationContactIds || [])
		});

		const organization: IOrganization = await this.organizationRepository.findOneBy({
			id: organizationId
		});
		const role: IRole = await this.roleRepository.findOneBy({
			id: roleId
		});
		const user: IUser = await this.userService.findOneByIdString(invitedById, {
			relations: ['role']
		});

		const tenantId = RequestContext.currentTenantId();
		if (role.name === RolesEnum.SUPER_ADMIN) {
			const { role: inviterRole } = user;
			if (inviterRole.name !== RolesEnum.SUPER_ADMIN) {
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

		const existingInvites = (
			await this.repository
				.createQueryBuilder('invite')
				.select('invite.email')
				.where('invite.email IN (:...emails)', { emails: emailIds })
				.getMany()
		).map((invite) => invite.email);

		const invitesToCreate = emailIds.filter(
			(email) => existingInvites.indexOf(email) < 0
		);

		for (let i = 0; i < invitesToCreate.length; i++) {
			const email = invitesToCreate[i];
			const token = this.createToken(email);

			const invite = new Invite();
			invite.token = token;
			invite.email = email;
			invite.roleId = roleId;
			invite.organizationId = organizationId;
			invite.tenantId = tenantId;
			invite.invitedById = invitedById;
			invite.status = InviteStatusEnum.INVITED;
			invite.expireDate = expireDate;
			invite.projects = projects;
			invite.departments = departments;
			invite.organizationContact = organizationContacts;
			invite.actionDate = startedWorkOn || appliedDate;
			invites.push(invite);
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
					invitedBy: user
				});
			} else if (emailInvites.inviteType === InvitationTypeEnum.EMPLOYEE) {
				this.emailService.inviteEmployee({
					email: item.email,
					registerUrl,
					organizationContacts,
					departments,
					originUrl,
					organization: organization,
					languageCode,
					invitedBy: user
				});
			}
		});

		return { items, total: items.length, ignored: existingInvites.length };
	}

	async resendEmail(data, invitedById, languageCode, expireDate){
		const {
			id,
			email,
			roleName,
			organization,
			departmentNames,
			clientNames
		} = data

		const status = InviteStatusEnum.INVITED;

		const originUrl = this.configSerice.get('clientBaseUrl') as string;

		const user: IUser = await this.userService.findOneByIdString(invitedById, {
			relations: ['role']
		});

		const token = this.createToken(email);

		const registerUrl = `${originUrl}/#/auth/accept-invite?email=${email}&token=${token}`;


		try{
			await this.update(id, {
			   status,
			   expireDate,
			   invitedById,
			   token
			})

			if (data.inviteType === InvitationTypeEnum.USER) {
				this.emailService.inviteUser({
					email,
					role: roleName,
					organization: organization,
					registerUrl,
					originUrl,
					languageCode,
					invitedBy: user
				});
			} else if (data.inviteType === InvitationTypeEnum.EMPLOYEE || data.inviteType === InvitationTypeEnum.CANDIDATE) {
				this.emailService.inviteEmployee({
					email,
					registerUrl,
					organizationContacts: clientNames,
					departments: departmentNames,
					originUrl,
					organization: organization,
					languageCode,
					invitedBy: user
				});
			}
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

		const organizationContact: IOrganizationContact = await this.organizationContactRepository.findOneBy({
			id: organizationContactId
		});
		const organization: Organization = await this.organizationRepository.findOneBy({
			id: organizationId
		});

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
		invite.organizationContact = [organizationContact];

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
	 * @param relations
	 * @returns
	 */
	async validate(
		where: FindOptionsWhere<Invite>,
		relations: string[] = []
	): Promise<IInvite> {
		try {
			const query = this.repository.createQueryBuilder();
			query.setFindOptions({
				select: {
					id: true,
					email: true,
					organization: {
						id: true,
						name: true
					}
				},
				...(
					(isNotEmpty(relations)) ? {
						relations: relations
					} : {}
				),
			});
			query.where((qb: SelectQueryBuilder<Invite>) => {
				qb.where({
					...where,
					status: InviteStatusEnum.INVITED
				})
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.where(
							[
								{
									expireDate: MoreThanOrEqual(new Date())
								},
								{
									expireDate: IsNull()
								}
							]
						);
					})
				);
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
	public async findAllInvites(options: any) {
		try {
			const query = this.repository.createQueryBuilder();
			query.setFindOptions({
				skip: (options && options.skip) ? (options.take * (options.skip - 1)) : 0,
				take: (options && options.take) ? (options.take) : 10,
				...(
					(options && options.relations) ? {
						relations: options.relations
					} : {}
				)
			});
			query.where((qb: SelectQueryBuilder<Invite>) => {
				qb.andWhere({
					tenantId: RequestContext.currentTenantId()
				});
				if (isNotEmpty(options.where)) {
					const { where } = options;
					if (isNotEmpty(where.organizationId)) {
						const { organizationId, tenantId } = where;
						qb.andWhere({
							organizationId,
							tenantId
						});
					}
					if (isNotEmpty(where.role)) {
						const { role } = where;
						qb.andWhere({
							role: {
								...role
							}
						});
					} else {
						qb.andWhere({
							role: {
								name: Not(RolesEnum.EMPLOYEE)
							}
						});
					}
				}
			});
			const [items, total] = await query.getManyAndCount();
			return { items, total };
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
