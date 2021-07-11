import {
	InviteStatusEnum,
	IOrganization,
	RolesEnum
} from '@gauzy/contracts';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { AuthService } from '../../../auth/auth.service';
import { OrganizationContactService } from '../../../organization-contact/organization-contact.service';
import { OrganizationService } from '../../../organization/organization.service';
import { TenantRoleBulkCreateCommand } from '../../../role/commands/tenant-role-bulk-create.command';
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
		private readonly commandBus: CommandBus
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
		const organization: IOrganization = await this.organizationService.create({
			...contactOrganization,
			tenant
		});

		// 3. Create Role and Role Permissions for contact
		await this.commandBus.execute(
			new TenantRoleBulkCreateCommand([tenant])
		);

		// 4. Find SUPER_ADMIN role to relative tenant.
		const role = await this.roleService.findOne({
			tenant,
			name: RolesEnum.SUPER_ADMIN
		});

		// 5. Create user account for contact and link role, tenant and organization
		await this.authService.register({
			user: { ...user, tenant, role },
			password,
			originalUrl,
			organizationId: organization.id
		}, languageCode );

		// 6. Link newly created contact organization to organization contact invite
		const { organizationContact } = await this.inviteService.findOne(
			inviteId,
			{
				relations: ['organizationContact']
			}
		);

		// TODO Make invite and contact as one to one, since an invite is not shared by multiple contacts
		const organizationContactId = organizationContact[0].id;

		await this.organizationContactService.update(organizationContactId, {
			tenant: tenant,
			organizationId: organization.id,
			inviteStatus: InviteStatusEnum.ACCEPTED
		});

		return this.inviteService.update(inviteId, {
			status: InviteStatusEnum.ACCEPTED
		});
	}
}
