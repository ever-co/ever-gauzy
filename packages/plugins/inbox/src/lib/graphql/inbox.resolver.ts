import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
	ID,
	IInboxItemCounts,
	IInboxItemPage,
	IInboxItemWithState,
	IInboxRecipientStateInput,
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
import { InboxItemQueryDTO, InboxStateDTO } from '../dto/inbox.dto';
import { InboxService } from '../inbox.service';

/** The `InboxItemFilter` input (the query of `GET /inbox/items` without its page). */
export type InboxItemFilterInput = Omit<InboxItemQueryDTO, 'cursor' | 'limit'>;

/**
 * Runs the REST route's own DTO rules on GraphQL arguments: GraphQL runs no `ValidationPipe`, so without this a
 * value the route refuses (an unknown tab, a non-UUID id, a limit of 1000) would reach the service here.
 * Members the DTO does not declare are dropped, as the route's `whitelist` does.
 */
export async function validatedInboxInput<T extends object>(type: new () => T, value: object): Promise<T> {
	const dto = plainToInstance(type, value ?? {});
	const errors = await validate(dto, { whitelist: true, forbidUnknownValues: false });
	if (errors.length) {
		throw new BadRequestException(errors.flatMap((error) => Object.values(error.constraints ?? {})));
	}
	return dto;
}

/**
 * The Inbox over GraphQL (plan 04 §3): the read routes of `/api/inbox/items` and `markInboxItem` (the state
 * route). REST and GraphQL are two views of the same operations, so this resolver owns no logic: every field
 * reaches the `InboxService` method its route reaches, with the arguments the route's DTO validates.
 *
 * - **Guards and permissions are the controller's:** `TenantPermissionGuard` and `PermissionGuard` with
 *   `INBOX_VIEW` on every field, plus the GraphQL capability gate every resolver carries (`FEATURE_GRAPHQL`).
 * - **The recipient is the caller:** the service reads the tenant and the user from the request context;
 *   no field takes a user, a recipient or a tenant argument, so nobody reads or marks another user's items.
 *   A holder of `INBOX_MAILBOX_READ_ALL` reads (never marks) what the route lets them read.
 */
@Resolver('InboxItem')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.INBOX_VIEW)
export class InboxResolver {
	constructor(private readonly inbox: InboxService) {}

	/** `GET /inbox/items`. */
	@Query('inboxItems')
	@Permissions(PermissionsEnum.INBOX_VIEW)
	async inboxItems(
		@Args('filter') filter?: InboxItemFilterInput | null,
		@Args('cursor') cursor?: string | null,
		@Args('limit') limit?: number | null
	): Promise<IInboxItemPage> {
		const query = await validatedInboxInput(InboxItemQueryDTO, {
			...(filter ?? {}),
			...(cursor !== null && cursor !== undefined ? { cursor } : {}),
			...(limit !== null && limit !== undefined ? { limit } : {})
		});
		return this.inbox.list(query);
	}

	/** `GET /inbox/items/counts`. */
	@Query('inboxItemCounts')
	@Permissions(PermissionsEnum.INBOX_VIEW)
	async inboxItemCounts(): Promise<IInboxItemCounts> {
		return this.inbox.counts();
	}

	/** `GET /inbox/items/:id` (a miss, or an item not addressed to the caller, is the route's 404). */
	@Query('inboxItem')
	@Permissions(PermissionsEnum.INBOX_VIEW)
	async inboxItem(@Args('id', UUIDValidationPipe) id: ID): Promise<IInboxItemWithState> {
		return this.inbox.get(id);
	}

	/** `PATCH /inbox/items/:id/state`: the caller's own state only; the source is told on a best-effort basis. */
	@Mutation('markInboxItem')
	@Permissions(PermissionsEnum.INBOX_VIEW)
	async markInboxItem(
		@Args('id', UUIDValidationPipe) id: ID,
		@Args('input') input: IInboxRecipientStateInput
	): Promise<IInboxItemWithState> {
		return this.inbox.setState(id, await validatedInboxInput(InboxStateDTO, input));
	}
}
