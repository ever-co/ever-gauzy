import { OrganizationClients } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationClientsService } from '../../../organization-clients/organization-clients.service';
import { InviteLinkOrganizationClientsCommand } from '../invite.link-organization-clients.command';
import { InviteService } from '../../invite.service';
import { BadRequestException } from '@nestjs/common';

@CommandHandler(InviteLinkOrganizationClientsCommand)
export class InviteLinkOrganizationClientsHandler
	implements ICommandHandler<InviteLinkOrganizationClientsCommand> {
	constructor(
		private readonly organizationClientsService: OrganizationClientsService,
		private readonly inviteService: InviteService
	) {}

	public async execute(
		command: InviteLinkOrganizationClientsCommand
	): Promise<OrganizationClients> {
		const {
			input: { inviteId, organizationId }
		} = command;

		const { clients } = await this.inviteService.findOne(inviteId, {
			relations: ['clients']
		});

		if (!clients) {
			throw new BadRequestException();
		}

		// TODO Make invite and client as one to one, since an invite is not shared by multiple clients
		const organizationClientId = clients[0].id;
		await this.organizationClientsService.update(organizationClientId, {
			clientOrganizationId: organizationId
		});
		return clients[0];
	}
}
