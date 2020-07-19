import {
	InviteStatusEnum,
	Organization as IOrganization,
	RolesEnum
} from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { AuthService } from '../../../auth/auth.service';
import { OrganizationContactService } from '../../../organization-contact/organization-contact.service';
import { OrganizationService } from '../../../organization/organization.service';
import { RolePermissionsService } from '../../../role-permissions/role-permissions.service';
import { RoleService } from '../../../role/role.service';
import { Tenant } from '../../../tenant/tenant.entity';
import { TenantService } from '../../../tenant/tenant.service';
import { Invite } from '../../invite.entity';
import { InviteService } from '../../invite.service';
import { InviteAcceptOrganizationContactCommand } from '../invite.accept-organization-contact.command';

@CommandHandler(InviteAcceptOrganizationContactCommand)
export class InviteAcceptOrganizationContactHandler
	implements ICommandHandler<InviteAcceptOrganizationContactCommand> {
	constructor(
		private readonly inviteService: InviteService,
		private readonly authService: AuthService,
		private readonly organizationService: OrganizationService,
		private readonly organizationContactService: OrganizationContactService,
		private readonly tenantService: TenantService,
		private readonly roleService: RoleService,
		private readonly rolePermissionService: RolePermissionsService
	) {}

	public async execute(
		command: InviteAcceptOrganizationContactCommand
	): Promise<Invite | UpdateResult> {
		const {
			input: {
				user,
				password,
				contactOrganization,
				inviteId,
				originalUrl
			},
			languageCode
		} = command;

		// 1. Create new tenant for the contact
		const tenant: Tenant = await this.tenantService.create({
			name: contactOrganization.name
		});

		// 2. Create Organization for the contact
		const contactOrg: IOrganization = await this.organizationService.create(
			{
				...contactOrganization,
				tenant
			}
		);

		// 3. Create Role and Role Permissions for contact
		const role = await this.roleService.create({
			name: RolesEnum.SUPER_ADMIN,
			tenant
		});
		this.rolePermissionService.updateRoles(tenant, role);

		// 4. Create user account for contact and link role, tenant and organization
		await this.authService.register(
			{
				user: { ...user, tenant, role },
				password,
				originalUrl,
				organizationId: contactOrg.id
			},
			languageCode
		);

		//4. Link newly created contact organization to organization contact invite
		const { organizationContact } = await this.inviteService.findOne(
			inviteId,
			{
				relations: ['contact']
			}
		);

		// TODO Make invite and contact as one to one, since an invite is not shared by multiple contacts
		const organizationContactId = organizationContact[0].id;
		await this.organizationContactService.update(organizationContactId, {
			contactOrganizationId: contactOrg.id,
			inviteStatus: InviteStatusEnum.ACCEPTED
		});

		return this.inviteService.update(inviteId, {
			status: InviteStatusEnum.ACCEPTED
		});
	}
}
