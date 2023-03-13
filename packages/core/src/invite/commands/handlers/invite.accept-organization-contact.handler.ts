import {
	ContactOrganizationInviteStatus,
	IInvite,
	InviteStatusEnum,
	IOrganization,
	ITenant,
	RolesEnum
} from '@gauzy/contracts';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { TenantFeatureOrganizationCreateCommand } from './../../../tenant/commands';
import { AuthService } from '../../../auth/auth.service';
import { OrganizationContactService } from '../../../organization-contact/organization-contact.service';
import { OrganizationService } from '../../../organization/organization.service';
import { TenantRoleBulkCreateCommand } from '../../../role/commands';
import { RoleService } from '../../../role/role.service';
import { TenantService } from '../../../tenant/tenant.service';
import { InviteService } from '../../invite.service';
import { InviteAcceptOrganizationContactCommand } from '../invite.accept-organization-contact.command';
import { ReportOrganizationCreateCommand } from './../../../reports/commands';

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
	) { }

	public async execute(
		command: InviteAcceptOrganizationContactCommand
	): Promise<IInvite | UpdateResult> {
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
		const { name } = contactOrganization;
		const tenant: ITenant = await this.tenantService.create({
			name
		});

		// 2. Create Role and Role Permissions for contact
		await this.commandBus.execute(
			new TenantRoleBulkCreateCommand([tenant])
		);

		// 3. Create Enabled/Disabled features for relative tenants.
		await this.commandBus.execute(
			new TenantFeatureOrganizationCreateCommand([tenant])
		);

		let { contact = {} } = contactOrganization;
		delete contactOrganization['contact'];

		// 4. Create Organization for the contact
		const organization: IOrganization = await this.organizationService.create({
			...contactOrganization,
			tenant
		});

		// 5. Create Enabled/Disabled reports for relative organization.
		await this.commandBus.execute(
			new ReportOrganizationCreateCommand(organization)
		);

		// 6. Create contact details of created organization
		const { id: organizationId } = organization;
		const { id: tenantId } = tenant;
		contact = Object.assign({}, contact, {
			organizationId,
			tenantId
		});

		await this.organizationService.create({
			contact,
			...organization
		});

		// 7. Find SUPER_ADMIN role to relative tenant.
		const role = await this.roleService.findOneByWhereOptions({
			tenantId,
			name: RolesEnum.SUPER_ADMIN
		});

		// 8. Create user account for contact and link role, tenant and organization
		await this.authService.register(
			{
				user: {
					...user,
					tenant,
					role
				},
				password,
				originalUrl,
				organizationId,
				inviteId
			},
			languageCode
		);

		// 8. Link newly created contact organization to organization contact invite
		const { organizationContacts } = await this.inviteService.findOneByIdString(inviteId, {
			relations: {
				organizationContacts: true
			}
		});

		// TODO Make invite and contact as one to one, since an invite is not shared by multiple contacts
		const [organizationContact] = organizationContacts;
		const { id: organizationContactId } = organizationContact;

		await this.organizationContactService.update(organizationContactId, {
			tenant,
			organization,
			inviteStatus: ContactOrganizationInviteStatus.ACCEPTED
		});

		return await this.inviteService.update(inviteId, {
			status: InviteStatusEnum.ACCEPTED
		});
	}
}
