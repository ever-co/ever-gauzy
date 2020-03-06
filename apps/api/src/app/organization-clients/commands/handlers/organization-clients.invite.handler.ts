import {
	OrganizationClients,
	InviteStatusEnum,
	ClientOrganizationInviteStatus
} from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationClientsInviteCommand } from '../organization-clients.invite.command';
import { OrganizationClientsService } from '../../organization-clients.service';
import { EmailService } from '../../../email';
import { Exception } from 'handlebars';

/**
 * Sends an invitation email to the organization client's primaryEmail
 */
@CommandHandler(OrganizationClientsInviteCommand)
export class OrganizationClientsInviteHandler
	implements ICommandHandler<OrganizationClientsInviteCommand> {
	constructor(
		private readonly organizationClientsService: OrganizationClientsService,
		private readonly emailService: EmailService
	) {}

	public async execute(
		command: OrganizationClientsInviteCommand
	): Promise<OrganizationClients> {
		const {
			input: { id, originalUrl, inviterUser }
		} = command;

		const organizationClient = await this.organizationClientsService.findOne(
			id
		);

		if (!organizationClient.primaryEmail) {
			throw new Error('No Primary Email');
		}

		// this.emailService.inviteOrganizationClient(
		// 	organizationClient,
		// 	originalUrl
		// );

		await this.organizationClientsService.update(id, {
			inviteStatus: ClientOrganizationInviteStatus.INVITED
		});

		return;
	}
}
