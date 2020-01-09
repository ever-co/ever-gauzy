import { environment as env } from '@env-api/environment';
import {
	CreateEmailInvitesInput,
	CreateEmailInvitesOutput,
	InviteStatusEnum,
	OrganizationProjects as IOrganizationProjects
} from '@gauzy/models';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { sign } from 'jsonwebtoken';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationProjects } from '../organization-projects';
import { Invite } from './invite.entity';

@Injectable()
export class InviteService extends CrudService<Invite> {
	constructor(
		@InjectRepository(Invite) inviteRepository: Repository<Invite>,
		@InjectRepository(OrganizationProjects)
		private readonly organizationProjectsRepository: Repository<
			OrganizationProjects
		>
	) {
		super(inviteRepository);
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
			organizationId,
			invitedById
		} = emailInvites;
		const expireDate = new Date();
		expireDate.setDate(expireDate.getDate() + 7);

		const projects: IOrganizationProjects[] = await this.organizationProjectsRepository.findByIds(
			projectIds || []
		);

		const existingInvites = (await this.repository
			.createQueryBuilder('invite')
			.select('invite.email')
			.where('invite.email IN (:...emails)', { emails: emailIds })
			.getMany()).map((invite) => invite.email);

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

			invites.push(invite);
		}

		const items = await this.repository.save(invites);
		return { items, total: items.length, ignored: existingInvites.length };
	}

	async validate(relations, email, token): Promise<Invite> {
		return this.findOne({
			relations,
			where: {
				email,
				token,
				expireDate: MoreThanOrEqual(new Date())
			}
		});
	}

	createToken(email): string {
		const token: string = sign({ email }, env.JWT_SECRET, {});
		return token;
	}
}
