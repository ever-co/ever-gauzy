import {
	OrganizationContact,
	ContactOrganizationInviteStatus,
	RolesEnum
} from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { User } from '../../../user/user.entity';
import { UserService } from '../../../user/user.service';
import { InternalServerErrorException } from '@nestjs/common';
import { InviteOrganizationContactCommand } from '../invite.organization-contact.command';
import { OrganizationContactService } from '../../../organization-contact/organization-contact.service';
import { InviteService } from '../../invite.service';
import { RoleService } from '../../../role/role.service';

/**
 * Sends an invitation email to the organization organizationContact's primaryEmail
 */
@CommandHandler(InviteOrganizationContactCommand)
export class InviteOrganizationContactHandler
	implements ICommandHandler<InviteOrganizationContactCommand> {
	constructor(
		private readonly organizationContactService: OrganizationContactService,
		private readonly inviteService: InviteService,
		private readonly userService: UserService,
		private readonly roleService: RoleService
	) {}

	public async execute(
		command: InviteOrganizationContactCommand
	): Promise<OrganizationContact> {
		const {
			input: { id, originalUrl, inviterUser, languageCode }
		} = command;

		const organizationContact: OrganizationContact = await this.organizationContactService.findOne(
			id
		);

		if (!organizationContact.primaryEmail) {
			throw new InternalServerErrorException('No Primary Email');
		}

		const alreadyExists = await this.userExistsForSameTenant(
			organizationContact.primaryEmail,
			inviterUser.tenantId
		);

		if (alreadyExists) {
			throw new InternalServerErrorException(
				'Contact email already exists in the account as a user'
			);
		}

		const { id: roleId } = await this.roleService.findOne({
			where: { name: RolesEnum.VIEWER }
		});

		this.inviteService.createOrganizationContactInvite({
			emailId: organizationContact.primaryEmail,
			roleId,
			organizationContactId: organizationContact.id,
			organizationId: organizationContact.organizationId,
			invitedById: inviterUser.id,
			originalUrl,
			languageCode
		});

		await this.organizationContactService.update(id, {
			inviteStatus: ContactOrganizationInviteStatus.INVITED
		});

		return {
			...organizationContact,
			inviteStatus: ContactOrganizationInviteStatus.INVITED
		};
	}

	/**
	 * This function is used to make sure we are not sending an invitation email to a user that
	 * exists for the same tenant.
	 *
	 * @param email Email address of the user to check
	 * @param tenantId Tenant id of the contact organization
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
