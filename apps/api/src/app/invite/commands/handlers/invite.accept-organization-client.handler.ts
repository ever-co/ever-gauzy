import {
	InviteStatusEnum,
	Organization as IOrganization,
	RolesEnum
} from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { AuthService } from '../../../auth/auth.service';
import { OrganizationClientsService } from '../../../organization-clients/organization-clients.service';
import { OrganizationService } from '../../../organization/organization.service';
import { RolePermissionsService } from '../../../role-permissions/role-permissions.service';
import { RoleService } from '../../../role/role.service';
import { Tenant } from '../../../tenant/tenant.entity';
import { TenantService } from '../../../tenant/tenant.service';
import { Invite } from '../../invite.entity';
import { InviteService } from '../../invite.service';
import { InviteAcceptOrganizationClientCommand } from '../invite.accept-organization-client.command';

@CommandHandler(InviteAcceptOrganizationClientCommand)
export class InviteAcceptOrganizationClientHandler
	implements ICommandHandler<InviteAcceptOrganizationClientCommand> {
	constructor(
		private readonly inviteService: InviteService,
		private readonly authService: AuthService,
		private readonly organizationService: OrganizationService,
		private readonly organizationClientsService: OrganizationClientsService,
		private readonly tenantService: TenantService,
		private readonly roleService: RoleService,
		private readonly rolePermissionService: RolePermissionsService
	) {}

	public async execute(
		command: InviteAcceptOrganizationClientCommand
	): Promise<Invite | UpdateResult> {
		const {
			input: {
				user,
				password,
				clientOrganization,
				inviteId,
				originalUrl
			},
			languageCode
		} = command;

		// 1. Create new tenant for the client
		const tenant: Tenant = await this.tenantService.create({
			name: clientOrganization.name
		});

		// 2. Create Organization for the client
		const clientOrg: IOrganization = await this.organizationService.create({
			...clientOrganization,
			tenant
		});

		// 3. Create Role and Role Permissions for client
		const role = await this.roleService.create({
			name: RolesEnum.SUPER_ADMIN,
			tenant
		});
		this.rolePermissionService.updateRoles(tenant, role);

		// 4. Create user account for client and link role, tenant and organization
		const client = await this.authService.register(
			{
				user: { ...user, tenant, role },
				password,
				originalUrl,
				organizationId: clientOrg.id
			},
			languageCode
		);

		//4. Link newly created client organization to organization client invite
		const { clients } = await this.inviteService.findOne(inviteId, {
			relations: ['clients']
		});

		// TODO Make invite and client as one to one, since an invite is not shared by multiple clients
		const organizationClientId = clients[0].id;
		await this.organizationClientsService.update(organizationClientId, {
			clientOrganizationId: clientOrg.id,
			inviteStatus: InviteStatusEnum.ACCEPTED
		});

		return this.inviteService.update(inviteId, {
			status: InviteStatusEnum.ACCEPTED
		});
	}
}
