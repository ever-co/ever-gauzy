import {
	OrganizationContacts,
	ClientOrganizationInviteStatus,
	RolesEnum
} from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { User } from '../../../user/user.entity';
import { UserService } from '../../../user/user.service';
import { InternalServerErrorException } from '@nestjs/common';
import { InviteOrganizationContactsCommand } from '../invite.organization-contacts.command';
import { OrganizationContactsService } from '../../../organization-contacts/organization-contacts.service';
import { InviteService } from '../../invite.service';
import { RoleService } from '../../../role/role.service';

/**
 * Sends an invitation email to the organization client's primaryEmail
 */
@CommandHandler(InviteOrganizationContactsCommand)
export class InviteOrganizationContactsHandler
	implements ICommandHandler<InviteOrganizationContactsCommand> {
	constructor(
		private readonly organizationContactsService: OrganizationContactsService,
		private readonly inviteService: InviteService,
		private readonly userService: UserService,
		private readonly roleService: RoleService
	) {}

	public async execute(
		command: InviteOrganizationContactsCommand
	): Promise<OrganizationContacts> {
		const {
			input: { id, originalUrl, inviterUser, languageCode }
		} = command;

		const organizationClient: OrganizationContacts = await this.organizationContactsService.findOne(
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

		const { id: roleId } = await this.roleService.findOne({
			where: { name: RolesEnum.VIEWER }
		});

		this.inviteService.createOrganizationContactInvite({
			emailId: organizationClient.primaryEmail,
			roleId,
			clientId: organizationClient.id,
			organizationId: organizationClient.organizationId,
			invitedById: inviterUser.id,
			originalUrl,
			languageCode
		});

		await this.organizationContactsService.update(id, {
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
