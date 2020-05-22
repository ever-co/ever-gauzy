import { environment as env } from '@env-api/environment';
import {
	ICreateEmailInvitesInput,
	ICreateEmailInvitesOutput,
	InviteStatusEnum,
	OrganizationProjects as IOrganizationProjects,
	OrganizationClients as IOrganizationClients,
	OrganizationDepartment as IOrganizationDepartment,
	Role as IOrganizationRole,
	User,
	ICreateOrganizationClientInviteInput,
	RolesEnum,
	LanguagesEnum
} from '@gauzy/models';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { sign } from 'jsonwebtoken';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { Invite } from './invite.entity';
import { OrganizationClients } from '../organization-clients/organization-clients.entity';
import { OrganizationDepartment } from '../organization-department/organization-department.entity';
import { Organization } from '../organization/organization.entity';
import { EmailService } from '../email/email.service';
import { Role } from '../role/role.entity';
import { addDays } from 'date-fns';
import { UserService } from '../user/user.service';

@Injectable()
export class InviteService extends CrudService<Invite> {
	constructor(
		@InjectRepository(Invite) inviteRepository: Repository<Invite>,
		@InjectRepository(OrganizationProjects)
		private readonly organizationProjectsRepository: Repository<
			OrganizationProjects
		>,

		@InjectRepository(OrganizationClients)
		private readonly organizationClientsRepository: Repository<
			OrganizationClients
		>,

		@InjectRepository(OrganizationDepartment)
		private readonly organizationDepartmentRepository: Repository<
			OrganizationDepartment
		>,
		@InjectRepository(Organization)
		private readonly organizationRepository: Repository<Organization>,
		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>,
		private readonly emailService: EmailService,
		private readonly userService: UserService
	) {
		super(inviteRepository);
	}

	// async sendInvitationMail(email: string, token: string): Promise<any> {
	// 	const url = `${env.host}:4200/#/auth/accept-invite?email=${email}&token=${token}`;

	// 	const testAccount = await nodemailer.createTestAccount();

	// 	const transporter = nodemailer.createTransport({
	// 		host: 'smtp.ethereal.email',
	// 		port: 587,
	// 		secure: false, // true for 465, false for other ports
	// 		auth: {
	// 			user: testAccount.user,
	// 			pass: testAccount.pass
	// 		}
	// 	});

	// 	const info = await transporter.sendMail({
	// 		from: 'Gauzy',
	// 		to: email,
	// 		subject: 'Invitation',
	// 		text: 'Invitation to Gauzy',
	// 		html:
	// 			'Hello! <br><br> You have been invited to Gauzy<br><br>To accept your invitation & create your account<br><br>' +
	// 			'<a href=' +
	// 			url +
	// 			'>Click here</a>'
	// 	});

	// 	console.log('Message sent: %s', info.messageId);
	// 	console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
	// }

	/**
	 * Creates all invites. If an email Id already exists, this function will first delete
	 * the existing invite and then create a new row with the email address.
	 * @param emailInvites Emails Ids to send invite
	 */
	async createBulk(
		emailInvites: ICreateEmailInvitesInput,
		originUrl: string,
		languageCode: LanguagesEnum
	): Promise<ICreateEmailInvitesOutput> {
		const invites: Invite[] = [];

		const {
			emailIds,
			roleId,
			projectIds,
			clientIds,
			departmentIds,
			organizationId,
			invitedById
		} = emailInvites;

		const projects: IOrganizationProjects[] = await this.organizationProjectsRepository.findByIds(
			projectIds || []
		);

		const departments: IOrganizationDepartment[] = await this.organizationDepartmentRepository.findByIds(
			departmentIds || []
		);

		const clients: IOrganizationClients[] = await this.organizationClientsRepository.findByIds(
			clientIds || []
		);

		const organization: Organization = await this.organizationRepository.findOne(
			organizationId
		);

		const role: IOrganizationRole = await this.roleRepository.findOne(
			roleId
		);

		if (role.name === RolesEnum.SUPER_ADMIN) {
			const { role: inviterRole } = await this.userService.findOne(
				invitedById,
				{
					relations: ['role']
				}
			);
			if (inviterRole.name !== RolesEnum.SUPER_ADMIN)
				throw new UnauthorizedException();
		}

		const inviteExpiryPeriod =
			organization && organization.inviteExpiryPeriod
				? organization.inviteExpiryPeriod
				: 7;

		const expireDate = addDays(new Date(), inviteExpiryPeriod);

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
			invite.invitedById = invitedById;
			invite.status = InviteStatusEnum.INVITED;
			invite.expireDate = expireDate;
			invite.projects = projects;
			invite.departments = departments;
			invite.clients = clients;

			invites.push(invite);
		}

		const items = await this.repository.save(invites);
		items.forEach((item) => {
			const registerUrl = `${originUrl ||
				env.host}/#/auth/accept-invite?email=${item.email}&token=${
				item.token
			}`;

			if (emailInvites.inviteType.indexOf('/pages/users') > -1) {
				this.emailService.inviteUser({
					email: item.email,
					role: role.name,
					organization: organization,
					registerUrl,
					originUrl,
					languageCode
				});
			} else if (
				emailInvites.inviteType.indexOf('/pages/employees') > -1
			) {
				this.emailService.inviteEmployee({
					email: item.email,
					registerUrl,
					clients,
					departments,
					originUrl,
					organization: organization,
					languageCode
				});
			}
		});

		return { items, total: items.length, ignored: existingInvites.length };
	}

	async createOrganizationClientInvite(
		inviteInput: ICreateOrganizationClientInviteInput
	): Promise<Invite> {
		const {
			emailId,
			roleId,
			clientId,
			organizationId,
			invitedById,
			originalUrl,
			languageCode
		} = inviteInput;

		const client: IOrganizationClients = await this.organizationClientsRepository.findOne(
			clientId
		);

		const organization: Organization = await this.organizationRepository.findOne(
			organizationId
		);

		const inviterUser: User = await this.userService.findOne(invitedById);

		const inviteExpiryPeriod =
			organization && organization.inviteExpiryPeriod
				? organization.inviteExpiryPeriod
				: 7;

		const expireDate = addDays(new Date(), inviteExpiryPeriod);

		const invite = new Invite();
		invite.token = this.createToken(emailId);
		invite.email = emailId;
		invite.roleId = roleId;
		invite.organizationId = organizationId;
		invite.invitedById = invitedById;
		invite.status = InviteStatusEnum.INVITED;
		invite.expireDate = expireDate;
		invite.clients = [client];

		const createdInvite = await this.repository.save(invite);

		this.emailService.inviteOrganizationClient(
			client,
			inviterUser,
			organization,
			createdInvite,
			languageCode,
			originalUrl
		);

		return createdInvite;
	}

	async validate(relations, email, token): Promise<Invite> {
		return this.findOne({
			relations,
			where: {
				email,
				token,
				expireDate: MoreThanOrEqual(new Date()),
				status: InviteStatusEnum.INVITED
			}
		});
	}

	createToken(email): string {
		const token: string = sign({ email }, env.JWT_SECRET, {});
		return token;
	}
}
