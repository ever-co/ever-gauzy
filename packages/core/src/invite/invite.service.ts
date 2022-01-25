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
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { sign } from 'jsonwebtoken';
import { Brackets, IsNull, MoreThanOrEqual, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
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

		const projects: IOrganizationProject[] = await this.organizationProjectsRepository.findByIds(
			projectIds || []
		);

		const departments: IOrganizationDepartment[] = await this.organizationDepartmentRepository.findByIds(
			departmentIds || []
		);

		const organizationContacts: IOrganizationContact[] = await this.organizationContactRepository.findByIds(
			organizationContactIds || []
		);

		const organization: IOrganization = await this.organizationRepository.findOne(
			organizationId
		);
		const role: IRole = await this.roleRepository.findOne(roleId);
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

	async resendEmail(data, invitedById, languageCode){
		const {
			id,
			expireDate,
			email,
			role,
			organization,
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

			this.emailService.inviteUser({
				email,
				role,
				organization,
				registerUrl,
				originUrl,
				languageCode,
				invitedBy: user
			});

			/* this.emailService.inviteEmployee({
				email 
				registerUrl,
				organizationContacts,
				departments,
				originUrl,
				organization: organization,
				languageCode,
				invitedBy: user
			}); */

		}catch(error){
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

		const organizationContact: IOrganizationContact = await this.organizationContactRepository.findOne(
			organizationContactId
		);

		const organization: Organization = await this.organizationRepository.findOne(
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

	async validate(relations, email: string, token: string): Promise<IInvite> {
		return await this.repository.findOne({
			where: (query: SelectQueryBuilder<Invite>) => {
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => { 
						qb.where(
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
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => { 
						qb.andWhere(`"${query.alias}"."email" = :email`, { email });
						qb.andWhere(`"${query.alias}"."token" = :token`, { token });
						qb.andWhere(`"${query.alias}"."status" = :status`, { status: InviteStatusEnum.INVITED });
					})
				);
			},
			relations
		});
	}

	createToken(email): string {
		const token: string = sign({ email }, environment.JWT_SECRET, {});
		return token;
	}
}
