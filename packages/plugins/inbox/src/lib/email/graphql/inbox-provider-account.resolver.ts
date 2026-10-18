import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID,
	IEmailProviderDescriptor,
	IInboxProviderAccount,
	IInboxProviderAccountCheck,
	IInboxProviderAccountCreated,
	IInboxProviderAccountCreateInput,
	IInboxProviderAccountRemoved,
	IInboxProviderAccountUpdateInput,
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
	CreateInboxProviderAccountDTO,
	InboxOrganizationQueryDTO,
	UpdateInboxProviderAccountDTO
} from '../provider-accounts/inbox-provider-account.dto';
import { InboxProviderAccountService } from '../provider-accounts/inbox-provider-account.service';

/**
 * The `?organizationId=` of a management route, through the route's own DTO rule (a UUID, or absent: the request's
 * selected organization). The service then checks the caller's membership of it, as it does for the route.
 */
export async function inboxOrganizationArgument(organizationId?: ID | null): Promise<ID | undefined> {
	if (organizationId === null || organizationId === undefined) return undefined;
	return (await validatedInboxInput(InboxOrganizationQueryDTO, { organizationId })).organizationId;
}

/**
 * Email provider plugins and provider accounts over GraphQL: the twins of `GET /inbox/providers` and
 * `/inbox/provider-accounts*` (plan 04 §3). REST and GraphQL are two views of the same operations, so this resolver
 * owns no logic: every field reaches the `InboxProviderAccountService` method its route reaches, with the arguments
 * the route's DTO validates.
 *
 * - **Guards and permissions are the controller's:** `TenantPermissionGuard` and `PermissionGuard` with
 *   `INBOX_MAILBOX_MANAGE` on every field, plus the GraphQL capability gate every resolver carries
 *   (`FEATURE_GRAPHQL`). The service checks the caller's membership of the organization (and `ALL_ORG_EDIT` for a
 *   tenant-wide account); the tenant is always the caller's, never an argument.
 * - **Secrets are write-only:** an account answers which secret fields are set, never their values; a secret the
 *   server generates is answered once, by the create or update that generated it.
 */
@Resolver('InboxProviderAccount')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
export class InboxProviderAccountResolver {
	constructor(private readonly accounts: InboxProviderAccountService) {}

	/** `GET /inbox/providers`. */
	@Query('inboxEmailProviders')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	inboxEmailProviders(): IEmailProviderDescriptor[] {
		return this.accounts.providers();
	}

	/** `GET /inbox/provider-accounts`. */
	@Query('inboxProviderAccounts')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async inboxProviderAccounts(@Args('organizationId') organizationId?: ID | null): Promise<IInboxProviderAccount[]> {
		return this.accounts.list(await inboxOrganizationArgument(organizationId));
	}

	/** `GET /inbox/provider-accounts/:id` (a miss, or another organization's account, is the route's 404). */
	@Query('inboxProviderAccount')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async inboxProviderAccount(
		@Args('id', UUIDValidationPipe) id: ID,
		@Args('organizationId') organizationId?: ID | null
	): Promise<IInboxProviderAccount> {
		return this.accounts.get(id, await inboxOrganizationArgument(organizationId));
	}

	/** `POST /inbox/provider-accounts`. */
	@Mutation('createInboxProviderAccount')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async createInboxProviderAccount(
		@Args('input') input: IInboxProviderAccountCreateInput
	): Promise<IInboxProviderAccountCreated> {
		return this.accounts.create(await validatedInboxInput(CreateInboxProviderAccountDTO, input));
	}

	/** `PATCH /inbox/provider-accounts/:id`. */
	@Mutation('updateInboxProviderAccount')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async updateInboxProviderAccount(
		@Args('id', UUIDValidationPipe) id: ID,
		@Args('input') input: IInboxProviderAccountUpdateInput,
		@Args('organizationId') organizationId?: ID | null
	): Promise<IInboxProviderAccountCreated> {
		const change = await validatedInboxInput(UpdateInboxProviderAccountDTO, input);
		return this.accounts.update(id, change, await inboxOrganizationArgument(organizationId));
	}

	/** `DELETE /inbox/provider-accounts/:id`: answers what the removal did (a miss is the route's 404). */
	@Mutation('deleteInboxProviderAccount')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async deleteInboxProviderAccount(
		@Args('id', UUIDValidationPipe) id: ID,
		@Args('organizationId') organizationId?: ID | null
	): Promise<IInboxProviderAccountRemoved> {
		return this.accounts.remove(id, await inboxOrganizationArgument(organizationId));
	}

	/** `POST /inbox/provider-accounts/:id/verify` ("Test connection"). */
	@Mutation('verifyInboxProviderAccount')
	@Permissions(PermissionsEnum.INBOX_MAILBOX_MANAGE)
	async verifyInboxProviderAccount(
		@Args('id', UUIDValidationPipe) id: ID,
		@Args('organizationId') organizationId?: ID | null
	): Promise<IInboxProviderAccountCheck> {
		return this.accounts.verify(id, await inboxOrganizationArgument(organizationId));
	}
}
