import {
	OrganizationClients,
	ClientOrganizationInviteStatus,
	RolesEnum
} from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { User } from '../../../user/user.entity';
import { UserService } from '../../../user/user.service';
import { InternalServerErrorException } from '@nestjs/common';
import { InviteOrganizationClientsCommand } from '../invite.organization-clients.command';
import { OrganizationClientsService } from '../../../organization-clients/organization-clients.service';
import { InviteService } from '../../invite.service';
import { RoleService } from '../../../role/role.service';

/**
 * Sends an invitation email to the organization client's primaryEmail
 */
@CommandHandler(InviteOrganizationClientsCommand)
export class InviteOrganizationClientsHandler
	implements ICommandHandler<InviteOrganizationClientsCommand> {
	constructor(
		private readonly organizationClientsService: OrganizationClientsService,
		private readonly inviteService: InviteService,
		private readonly userService: UserService,
		private readonly roleService: RoleService
	) {}

	public async execute(
		command: InviteOrganizationClientsCommand
	): Promise<OrganizationClients> {
		const {
			input: { id, originalUrl, inviterUser, languageCode }
		} = command;

		const organizationClient: OrganizationClients = await this.organizationClientsService.findOne(
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

		this.inviteService.createOrganizationClientInvite({
			emailId: organizationClient.primaryEmail,
			roleId,
			clientId: organizationClient.id,
			organizationId: organizationClient.organizationId,
			invitedById: inviterUser.id,
			originalUrl,
			languageCode
		});

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
