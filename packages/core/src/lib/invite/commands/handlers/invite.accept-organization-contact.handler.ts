import { ConflictException } from '@nestjs/common';
import {
	InviteStatusEnum,
	ContactOrganizationInviteStatus,
	IInvite,
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

		// 0. Claim the invite BEFORE creating anything — see InviteService.claimInvite. This handler
		// provisions a whole tenant, organization and user account, so two parallel acceptances of
		// one invite would otherwise build two of each. The conditional flip to ACCEPTED is the
		// only thing that serializes them, and it has to happen ahead of the first side effect.
		if (!(await this.inviteService.claimInvite(inviteId))) {
			throw new ConflictException('Invite has already been accepted');
		}

		try {
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

			// Keep the original return shape. Re-reading the invite here would serialize the whole
			// row — including its token — back to an unauthenticated caller on this public endpoint.
			// The status write is redundant now that the claim above owns it, but it is idempotent
			// and preserves exactly what callers of this handler received before.
			return await this.inviteService.update(inviteId, {
				status: InviteStatusEnum.ACCEPTED
			});
		} catch (error) {
			// Deliberately do NOT release the invite here. Unlike the find-or-create handlers, this
			// one provisions a whole tenant, organization and role in separate un-rolled-back writes;
			// by the time a later step throws, those records are already committed. Returning to INVITED
			// would let a retry provision a SECOND tenant for the same contact. Leaving it ACCEPTED
			// blocks that — recovering a half-provisioned contact is a deliberate admin action, which
			// is the safe default for orphaned provisioning and strictly safer than the pre-claim
			// behaviour, where a failure left the invite INVITED and every retry re-provisioned.
			throw error;
		}
	}
}
