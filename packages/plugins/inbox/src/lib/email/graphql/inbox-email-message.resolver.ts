import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID, IInboxEmail, IInboxEmailForwardInput, IInboxEmailReplyInput, PermissionsEnum } from '@gauzy/contracts';
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
import { InboxEmailForwardDTO, InboxEmailReplyDTO, InboxQuarantineQueryDTO } from '../emails/inbox-email.controller';
import { InboxEmailService } from '../emails/inbox-email.service';

/**
 * Stored messages over GraphQL: the twins of `/inbox/emails*` (plan 04 §3) — one message, its thread, a mailbox's
 * quarantine, reply, forward and release. The raw-message and attachment downloads are byte streams (attachment
 * headers, `nosniff`, a sandbox CSP) and stay REST-only; a message answers its attachments' metadata.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no logic: every field reaches the
 * `InboxEmailService` method its route reaches, with the arguments the route's DTO validates. The guards and the
 * permission are the controller's (`INBOX_VIEW`, plus `FEATURE_GRAPHQL`); the service then checks the caller's access
 * to the message's mailbox (a recipient for reading and replying, a manager for the quarantine and its release),
 * exactly as for the route.
 */
@Resolver('InboxEmail')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.INBOX_VIEW)
export class InboxEmailMessageResolver {
	constructor(private readonly emails: InboxEmailService) {}

	/** `GET /inbox/emails/:id`: sanitized HTML, text, addresses, attachment metadata. */
	@Query('inboxEmail')
	@Permissions(PermissionsEnum.INBOX_VIEW)
	async inboxEmail(@Args('id', UUIDValidationPipe) id: ID): Promise<IInboxEmail> {
		return this.emails.get(id);
	}

	/** `GET /inbox/emails/:id/thread`: the messages of the thread the caller may read, oldest first. */
	@Query('inboxEmailThread')
	@Permissions(PermissionsEnum.INBOX_VIEW)
	async inboxEmailThread(@Args('id', UUIDValidationPipe) id: ID): Promise<IInboxEmail[]> {
		return this.emails.thread(id);
	}

	/** `GET /inbox/emails/quarantine?mailboxId=`: a mailbox's held messages, for its managers. */
	@Query('inboxQuarantinedEmails')
	@Permissions(PermissionsEnum.INBOX_VIEW)
	async inboxQuarantinedEmails(@Args('mailboxId') mailboxId: ID): Promise<IInboxEmail[]> {
		const query = await validatedInboxInput(InboxQuarantineQueryDTO, { mailboxId });
		return this.emails.quarantine(query.mailboxId);
	}

	/** `POST /inbox/emails/:id/reply`: from the mailbox's address, in the thread. */
	@Mutation('replyInboxEmail')
	@Permissions(PermissionsEnum.INBOX_VIEW)
	async replyInboxEmail(
		@Args('id', UUIDValidationPipe) id: ID,
		@Args('input') input: IInboxEmailReplyInput
	): Promise<IInboxEmail> {
		return this.emails.reply(id, await validatedInboxInput(InboxEmailReplyDTO, input));
	}

	/** `POST /inbox/emails/:id/forward`: from the mailbox's address, with the attachments by default. */
	@Mutation('forwardInboxEmail')
	@Permissions(PermissionsEnum.INBOX_VIEW)
	async forwardInboxEmail(
		@Args('id', UUIDValidationPipe) id: ID,
		@Args('input') input: IInboxEmailForwardInput
	): Promise<IInboxEmail> {
		return this.emails.forward(id, await validatedInboxInput(InboxEmailForwardDTO, input));
	}

	/** `POST /inbox/emails/:id/release`: a quarantined message into its mailbox recipients' inboxes. */
	@Mutation('releaseInboxEmail')
	@Permissions(PermissionsEnum.INBOX_VIEW)
	async releaseInboxEmail(@Args('id', UUIDValidationPipe) id: ID): Promise<IInboxEmail> {
		return this.emails.release(id);
	}
}
