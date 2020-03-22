import {
	OrganizationClients,
	ClientOrganizationInviteStatus
} from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EmailService } from '../../../email';
import { OrganizationService } from '../../../organization/organization.service';
import { UserService, User } from '../../../user';
import { InternalServerErrorException } from '@nestjs/common';
import { InviteOrganizationClientsCommand } from '../invite.organization-clients.command';
import { OrganizationClientsService } from '../../../organization-clients';

/**
 * Sends an invitation email to the organization client's primaryEmail
 */
@CommandHandler(InviteOrganizationClientsCommand)
export class InviteOrganizationClientsHandler
	implements ICommandHandler<InviteOrganizationClientsCommand> {
	constructor(
		private readonly organizationClientsService: OrganizationClientsService,
		private readonly emailService: EmailService,
		private readonly organizationService: OrganizationService,
		private readonly userService: UserService
	) {}

	public async execute(
		command: InviteOrganizationClientsCommand
	): Promise<OrganizationClients> {
		const {
			input: { id, originalUrl, inviterUser }
		} = command;

		const organizationClient = await this.organizationClientsService.findOne(
			id
		);

		if (!organizationClient.primaryEmail) {
			throw new InternalServerErrorException('No Primary Email');
		}

		const alreadyExists = await this.userExistsForSameTenant(
			organizationClient.primaryEmail,
			inviterUser.tenantId
		);

		if (alreadyExists) {
			throw new InternalServerErrorException(
				'Client email already exists in the account as a user'
			);
		}

		const organization = await this.organizationService.findOne(
			organizationClient.organizationId
		);

		this.emailService.inviteOrganizationClient(
			organizationClient,
			inviterUser,
			organization,
			originalUrl
		);

		await this.organizationClientsService.update(id, {
			inviteStatus: ClientOrganizationInviteStatus.INVITED
		});

		return {
			...organizationClient,
			inviteStatus: ClientOrganizationInviteStatus.INVITED
		};
	}

	/**
	 * This function is used to make sure we are not sending an invitation email to a user that
	 * exists for the same tenant.
	 *
	 * @param email Email address of the user to check
	 * @param tenantId Tenant id of the client organization
	 */
	private async userExistsForSameTenant(email, tenantId) {
		let user: User;
		try {
			user = await this.userService.getUserByEmail(email);
		} catch (error) {}

		if (!user) {
			return false;
		}

		// TODO: Once tenantId is stored in user properly
		// return user.tenantId === tenantId;
		return true;
	}
}
