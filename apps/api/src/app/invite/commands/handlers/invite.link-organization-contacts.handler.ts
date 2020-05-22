import { OrganizationContacts } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationContactsService } from '../../../organization-contacts/organization-contacts.service';
import { InviteLinkOrganizationContactsCommand } from '../invite.link-organization-contacts.command';
import { InviteService } from '../../invite.service';
import { BadRequestException } from '@nestjs/common';

@CommandHandler(InviteLinkOrganizationContactsCommand)
export class InviteLinkOrganizationContactsHandler
	implements ICommandHandler<InviteLinkOrganizationContactsCommand> {
	constructor(
		private readonly organizationContactsService: OrganizationContactsService,
		private readonly inviteService: InviteService
	) {}

	public async execute(
		command: InviteLinkOrganizationContactsCommand
	): Promise<OrganizationContacts> {
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
		await this.organizationContactsService.update(organizationClientId, {
			clientOrganizationId: organizationId
		});
		return clients[0];
	}
}
