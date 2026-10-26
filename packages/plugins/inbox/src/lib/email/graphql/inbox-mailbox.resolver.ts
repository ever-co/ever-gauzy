import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID,
	IInboxMailbox,
	IInboxMailboxCreateInput,
	IInboxMailboxDomainVerification,
	IInboxMailboxMember,
	IInboxMailboxMemberInput,
	IInboxMailboxProvisionInput,
	IInboxMailboxProvisionResult,
	IInboxMailboxSecret,
	IInboxMailboxUpdateInput,
	IInboxOrganizationEmailSettings,
	PermissionsEnum
} from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import {
	FEATURE_GRAPHQL,
	FeatureFlagGuard,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe
} from '@gauzy/core';
import { validatedInboxInput } from '../../graphql/inbox.resolver';
import {
	CreateInboxMailboxDTO,
	InboxEmailSettingsDTO,
	ProvisionInboxMailboxesDTO,
	SetInboxMailboxMembersDTO,
	UpdateInboxMailboxDTO
} from '../mailboxes/inbox-mailbox.dto';
import { InboxMailboxService } from '../mailboxes/inbox-mailbox.service';
import { inboxOrganizationArgument } from './inbox-provider-account.resolver';

/**
 * Mailboxes over GraphQL: the twins of `/inbox/mailboxes*` (plan 04 §3, G-P4-1). REST and GraphQL are two views of
 * the same operations, so this resolver owns no logic: every field reaches the `InboxMailboxService` method its route
 * reaches, with the arguments the route's DTO validates.
 *
 * - **Guards and permissions are the controller's:** `TenantPermissionGuard` and `PermissionGuard` on every field,
 *   `INBOX_VIEW` for the caller's own mailboxes (`myInboxMailboxes`, the route `GET /mailboxes/mine`) and
 *   `INBOX_MAILBOX_MANAGE` for everything else (the class default, so a field that states nothing is the stricter
 *   one), plus the GraphQL capability gate every resolver carries (`FEATURE_GRAPHQL`). The service checks the
 *   caller's membership of the organization; the tenant is always the caller's, never an argument.
 * - **Secrets:** a mailbox never answers its relay secret's digest or its verification token; a rotated relay
 *   secret is answered once, by `rotateInboxMailboxSecret`.
 * - **Ever Works routing (P4c)** is the mailbox's `settings.everWorksAgentId`, set with `updateInboxMailbox`.
 */
@Resolver('InboxMailbox')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
export class InboxMailboxResolver {
	constructor(private readonly mailboxes: InboxMailboxService) {}

	/** `GET /inbox/mailboxes/mine`: my employee mailbox and the shared ones I receive, by the delivery rules. */
	@Query('myInboxMailboxes')
	@Permissions(PermissionsEnum.INBOX_VIEW)
	async myInboxMailboxes(): Promise<Array<IInboxMailbox & { forwardingInstructions?: string }>> {
		return this.mailboxes.mine();
	}

	/** `GET /inbox/mailboxes`. */
	@Query('inboxMailboxes')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async inboxMailboxes(@Args('organizationId') organizationId?: ID | null): Promise<IInboxMailbox[]> {
		return this.mailboxes.list(await inboxOrganizationArgument(organizationId));
	}

	/** `GET /inbox/mailboxes/:id` (a miss, or another organization's mailbox, is the route's 404). */
	@Query('inboxMailbox')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async inboxMailbox(
		@Args('id', UUIDValidationPipe) id: ID,
		@Args('organizationId') organizationId?: ID | null
	): Promise<IInboxMailbox> {
		return this.mailboxes.get(id, await inboxOrganizationArgument(organizationId));
	}

	/** `GET /inbox/mailboxes/:id/verification`: the DNS record and its last status, without a lookup. */
	@Query('inboxMailboxDomainVerification')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async inboxMailboxDomainVerification(
		@Args('id', UUIDValidationPipe) id: ID,
		@Args('organizationId') organizationId?: ID | null
	): Promise<IInboxMailboxDomainVerification> {
		return this.mailboxes.verification(id, await inboxOrganizationArgument(organizationId));
	}

	/** `GET /inbox/mailboxes/:id/members`. */
	@Query('inboxMailboxMembers')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async inboxMailboxMembers(
		@Args('id', UUIDValidationPipe) id: ID,
		@Args('organizationId') organizationId?: ID | null
	): Promise<IInboxMailboxMember[]> {
		return this.mailboxes.members(id, await inboxOrganizationArgument(organizationId));
	}

	/** `GET /inbox/mailboxes/settings`. */
	@Query('inboxEmailSettings')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async inboxEmailSettings(
		@Args('organizationId') organizationId?: ID | null
	): Promise<IInboxOrganizationEmailSettings> {
		return this.mailboxes.settings(await inboxOrganizationArgument(organizationId));
	}

	/** `POST /inbox/mailboxes`. */
	@Mutation('createInboxMailbox')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async createInboxMailbox(
		@Args('input') input: IInboxMailboxCreateInput
	): Promise<IInboxMailbox & { verification?: IInboxMailboxDomainVerification }> {
		return this.mailboxes.create(await validatedInboxInput(CreateInboxMailboxDTO, input));
	}

	/** `PATCH /inbox/mailboxes/:id` (incl. the Ever Works agent routing, `settings.everWorksAgentId`). */
	@Mutation('updateInboxMailbox')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async updateInboxMailbox(
		@Args('id', UUIDValidationPipe) id: ID,
		@Args('input') input: IInboxMailboxUpdateInput,
		@Args('organizationId') organizationId?: ID | null
	): Promise<IInboxMailbox> {
		const change = await validatedInboxInput(UpdateInboxMailboxDTO, input);
		return this.mailboxes.update(id, change, await inboxOrganizationArgument(organizationId));
	}

	/** `POST /inbox/mailboxes/:id/verify`: looks the custom domain's TXT record up. */
	@Mutation('verifyInboxMailboxDomain')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async verifyInboxMailboxDomain(
		@Args('id', UUIDValidationPipe) id: ID,
		@Args('organizationId') organizationId?: ID | null
	): Promise<IInboxMailboxDomainVerification> {
		return this.mailboxes.verify(id, await inboxOrganizationArgument(organizationId));
	}

	/** `POST /inbox/mailboxes/:id/rotate-secret`: the new relay secret, answered this once. */
	@Mutation('rotateInboxMailboxSecret')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async rotateInboxMailboxSecret(
		@Args('id', UUIDValidationPipe) id: ID,
		@Args('organizationId') organizationId?: ID | null
	): Promise<IInboxMailboxSecret> {
		return this.mailboxes.rotateSecret(id, await inboxOrganizationArgument(organizationId));
	}

	/** `PUT /inbox/mailboxes/:id/members`: replaces the members of a shared mailbox. */
	@Mutation('setInboxMailboxMembers')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async setInboxMailboxMembers(
		@Args('id', UUIDValidationPipe) id: ID,
		@Args('members') members: IInboxMailboxMemberInput[],
		@Args('organizationId') organizationId?: ID | null
	): Promise<IInboxMailboxMember[]> {
		const body = await validatedInboxInput(SetInboxMailboxMembersDTO, { members });
		return this.mailboxes.setMembers(id, body.members, await inboxOrganizationArgument(organizationId));
	}

	/** `POST /inbox/mailboxes/provision`. */
	@Mutation('provisionInboxMailboxes')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async provisionInboxMailboxes(
		@Args('input') input?: IInboxMailboxProvisionInput | null
	): Promise<IInboxMailboxProvisionResult> {
		return this.mailboxes.provision(await validatedInboxInput(ProvisionInboxMailboxesDTO, input ?? {}));
	}

	/** `PUT /inbox/mailboxes/settings`. */
	@Mutation('updateInboxEmailSettings')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async updateInboxEmailSettings(
		@Args('input') input: { autoProvisionEmployees: boolean },
		@Args('organizationId') organizationId?: ID | null
	): Promise<IInboxOrganizationEmailSettings> {
		const body = await validatedInboxInput(InboxEmailSettingsDTO, input);
		return this.mailboxes.updateSettings(body, await inboxOrganizationArgument(organizationId));
	}
}
