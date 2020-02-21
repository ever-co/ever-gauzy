import { environment as env } from '@env-api/environment';
import {
	CreateEmailInvitesInput,
	CreateEmailInvitesOutput,
	InviteStatusEnum,
	OrganizationProjects as IOrganizationProjects,
	OrganizationClients as IOrganizationClients,
	OrganizationDepartment as IOrganizationDepartment
} from '@gauzy/models';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { sign } from 'jsonwebtoken';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationProjects } from '../organization-projects';
import { Invite } from './invite.entity';
import * as nodemailer from 'nodemailer';
import { OrganizationClients } from '../organization-clients';
import { OrganizationDepartment } from '../organization-department';
import { Organization } from '../organization';

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
		private readonly organizationRepository: Repository<Organization>
	) {
		super(inviteRepository);
	}

	async sendInvitationMail(email: string, token: string): Promise<any> {
		const url = `${env.host}:4200/#/auth/accept-invite?email=${email}&token=${token}`;

		const testAccount = await nodemailer.createTestAccount();

		const transporter = nodemailer.createTransport({
			host: 'smtp.ethereal.email',
			port: 587,
			secure: false, // true for 465, false for other ports
			auth: {
				user: testAccount.user,
				pass: testAccount.pass
			}
		});

		const info = await transporter.sendMail({
			from: 'Gauzy',
			to: email,
			subject: 'Invitation',
			text: 'Invitation to Gauzy',
			html:
				'Hello! <br><br> You have been invited to Gauzy<br><br>To accept your invitation & create your account<br><br>' +
				'<a href=' +
				url +
				'>Click here</a>'
		});

		console.log('Message sent: %s', info.messageId);
		console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
	}

	/**
	 * Creates all invites. If an email Id already exists, this function will first delete
	 * the existing invite and then create a new row with the email address.
	 * @param emailInvites Emails Ids to send invite
	 */
	async createBulk(
		emailInvites: CreateEmailInvitesInput
	): Promise<CreateEmailInvitesOutput> {
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

		const inviteExpiryPeriod =
			organization && organization.inviteExpiryPeriod
				? organization.inviteExpiryPeriod
				: 7;

		const expireDate = new Date();
		expireDate.setDate(expireDate.getDate() + inviteExpiryPeriod);

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
		items.forEach((item) =>
			this.sendInvitationMail(item.email, item.token)
		);
		return { items, total: items.length, ignored: existingInvites.length };
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
