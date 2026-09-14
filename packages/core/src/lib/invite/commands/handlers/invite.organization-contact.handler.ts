import { InternalServerErrorException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
	IOrganizationContact,
	ContactOrganizationInviteStatus,
	RolesEnum,
	ID,
	IUser
} from '@gauzy/contracts';
import { UserService } from '../../../user/user.service';
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

	/**
	 * Executes the InviteOrganizationContactCommand by validating the organization contact,
	 * checking for existing users, creating an invite, and updating the invite status.
	 *
	 * @param command - The command containing the necessary input data.
	 * @returns The updated organization contact with the invite status set to 'INVITED'.
	 * @throws InternalServerErrorException if required conditions are not met.
	 */
	public async execute(
		command: InviteOrganizationContactCommand
	): Promise<IOrganizationContact> {
		try {
			const { input: { id, originalUrl, inviterUser, languageCode } } = command;

			// Retrieve the organization contact.
			const organizationContact = await this.organizationContactService.findOneByIdString(id);

			if (!organizationContact) {
				throw new InternalServerErrorException(
					`Organization contact with id '${id}' was not found. Please verify that the contact exists in the system and that the provided id is correct.`
				);
			}

			if (!organizationContact.primaryEmail) {
				throw new InternalServerErrorException(
					`Organization contact with id ${organizationContact.id} does not have a primary email address. A valid primary email is required to send the invitation. Please update the contact's email information and try again.`
				);
			}

			// Ensure that a user with the same email does not already exist in the tenant.
			const alreadyExists = await this.userExistsForSameTenant(
				organizationContact.primaryEmail,
				inviterUser.tenantId
			);
			if (alreadyExists) {
				throw new InternalServerErrorException(
					'Contact email already exists in the account as a user'
				);
			}

			// Retrieve the role id for a viewer.
			const { id: roleId } = await this.roleService.findOneByOptions({
				where: { name: RolesEnum.VIEWER },
			});

			// Create the organization contact invite and wait for its completion.
			await this.inviteService.createOrganizationContactInvite({
				emailId: organizationContact.primaryEmail,
				roleId,
				organizationContactId: organizationContact.id,
				organizationId: organizationContact.organizationId,
				invitedByUserId: inviterUser.id,
				originalUrl,
				languageCode,
			});

			// Update the invite status of the organization contact.
			await this.organizationContactService.update(id, {
				inviteStatus: ContactOrganizationInviteStatus.INVITED,
			});

			// Return the updated organization contact.
			return {
				...organizationContact,
				inviteStatus: ContactOrganizationInviteStatus.INVITED,
			};
		} catch (error) {
			console.error('Error executing InviteOrganizationContactCommand:', error);
			throw new InternalServerErrorException(error?.message || 'Error executing invite command');
		}
	}

	/**
	 * This function is used to make sure we are not sending an invitation email to a user that
	 * exists for the same tenant.
	 *
	 * Despite its name and its `tenantId` argument, this check used to run the GLOBAL
	 * `getUserByEmail` lookup and ignore the tenant entirely, so a user of ANY OTHER tenant holding
	 * the contact's address answered "already exists". That was both a cross-tenant existence
	 * oracle — the caller learns, from a distinguishable error, that some unrelated tenant has an
	 * account with that email — and a functional bug, because it blocked a perfectly legitimate
	 * contact invitation.
	 *
	 * @param email Email address of the user to check
	 * @param tenantId Tenant id of the contact organization
	 */
	private async userExistsForSameTenant(email: string, tenantId: ID): Promise<boolean> {
		// Fail closed: without a tenant there is no "same tenant" to compare against, and the
		// tenant-scoped lookup would answer `null` for everything. Refuse rather than let an
		// unscoped invitation through.
		if (!tenantId) {
			throw new InternalServerErrorException(
				'Cannot invite an organization contact without a tenant context.'
			);
		}

		let user: IUser;
		try {
			user = await this.userService.getUserByEmailInTenant(email, tenantId);
		} catch (error) {}

		if (!user) {
			return false;
		}

		// The lookup is already tenant-scoped; comparing again keeps the invariant local and
		// visible, so a future change to the lookup cannot silently widen this check.
		return user.tenantId === tenantId;
	}
}
