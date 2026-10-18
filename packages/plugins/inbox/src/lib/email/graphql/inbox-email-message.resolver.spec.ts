// cspell:ignore dmarc
/**
 * The GraphQL twins of the stored-message routes (`/inbox/emails*`): one message, its thread, a mailbox's quarantine,
 * reply, forward and release. The SDL answers a message as the route does, every root field is bound and wired, the
 * class carries the controller's guards and `INBOX_VIEW` (the service then checks the caller's access to the
 * message's mailbox, as for the route), every field reaches the service method of its route, and the routes' DTO rules
 * refuse what the routes refuse. The raw-message and attachment downloads are byte streams and stay REST-only.
 */
jest.mock('@gauzy/core', () => jest.requireActual('../testing/graphql-core-double').coreDouble());
jest.mock('@gauzy/common', () => jest.requireActual('../testing/graphql-core-double').commonDouble());
jest.mock('@gauzy/plugin', () => jest.requireActual('../testing/graphql-core-double').pluginDouble());

import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA, MODULE_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { buildSchema, extendSchema, GraphQLObjectType, GraphQLSchema } from 'graphql';
import { PermissionsEnum } from '@gauzy/contracts';
import { InboxEmailForwardDTO, InboxEmailReplyDTO } from '../emails/inbox-email.controller';
import { MAX_OUTBOUND_RECIPIENTS, MAX_OUTBOUND_TEXT } from '../emails/inbox-email.service';
import { InboxEmailModule } from '../inbox-email.module';
import { InboxEmailPlugin } from '../inbox-email.plugin';
import { inboxEmailSchemaExtensions } from './inbox-email.schema';
import { InboxEmailMessageResolver } from './inbox-email-message.resolver';

const EMAIL_ID = '0b5a3f4e-6c1d-4f7a-9a52-3c2d1e0f9b8a';
const MAILBOX_ID = '7d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const CORE_SDL = 'scalar DateTime\nscalar JSON\ntype Query { ping: Boolean }\ntype Mutation { ping: Boolean }';
const QUERIES = ['inboxEmail', 'inboxEmailThread', 'inboxQuarantinedEmails'];
const MUTATIONS = ['replyInboxEmail', 'forwardInboxEmail', 'releaseInboxEmail'];
/** Every member `InboxEmailService.toEmail` answers (`IInboxEmail`), and the attachments `get` adds. */
const EMAIL_MEMBERS = [
	'id',
	'tenantId',
	'organizationId',
	'createdAt',
	'updatedAt',
	'mailboxId',
	'threadId',
	'direction',
	'messageId',
	'inReplyTo',
	'references',
	'from',
	'to',
	'cc',
	'bcc',
	'replyTo',
	'subject',
	'textBody',
	'htmlSanitized',
	'snippet',
	'headers',
	'spf',
	'dkim',
	'dmarc',
	'spamScore',
	'spamVerdict',
	'receivedAt',
	'sentAt',
	'sizeBytes',
	'status',
	'providerMessageId',
	'error',
	'inboxItemId',
	'attachments'
];
/** Every member of `IInboxEmailAttachment` (metadata only: the bytes are a REST download). */
const ATTACHMENT_MEMBERS = [
	'id',
	'emailId',
	'filename',
	'contentType',
	'size',
	'sha256',
	'contentId',
	'isInline',
	'savedDocumentId'
];

function composed(): GraphQLSchema {
	return extendSchema(buildSchema(CORE_SDL), inboxEmailSchemaExtensions);
}

function objectFields(schema: GraphQLSchema, name: string): string[] {
	return Object.keys((schema.getType(name) as GraphQLObjectType).getFields()).sort();
}

function method(name: string): object {
	return (InboxEmailMessageResolver.prototype as unknown as Record<string, object>)[name];
}

function setup() {
	const email = { id: EMAIL_ID, mailboxId: MAILBOX_ID, direction: 'IN', status: 'PROCESSED' };
	const emails = {
		get: jest.fn(async () => ({ ...email, attachments: [] })),
		thread: jest.fn(async () => [email]),
		quarantine: jest.fn(async () => [{ ...email, status: 'QUARANTINED' }]),
		reply: jest.fn(async () => ({ ...email, direction: 'OUT', status: 'SENT' })),
		forward: jest.fn(async () => ({ ...email, direction: 'OUT', status: 'SENT' })),
		release: jest.fn(async () => email),
		raw: jest.fn(),
		attachment: jest.fn()
	};
	return { emails, resolver: new InboxEmailMessageResolver(emails as never) };
}

describe('Inbox email GraphQL: messages', () => {
	it('declares a field for every message route but the byte downloads, and answers a message as the route does', () => {
		const schema = composed();
		expect(Object.keys(schema.getQueryType()?.getFields() ?? {})).toEqual(expect.arrayContaining(QUERIES));
		expect(Object.keys(schema.getMutationType()?.getFields() ?? {})).toEqual(expect.arrayContaining(MUTATIONS));
		expect(objectFields(schema, 'InboxEmail')).toEqual([...EMAIL_MEMBERS].sort());
		expect(objectFields(schema, 'InboxEmailAttachment')).toEqual([...ATTACHMENT_MEMBERS].sort());
		// No storage key, raw source or attachment bytes are reachable over GraphQL.
		expect(
			[...objectFields(schema, 'InboxEmail'), ...objectFields(schema, 'InboxEmailAttachment')].filter((field) =>
				/storage|raw|content$|bytes$/i.test(field)
			)
		).toEqual(['sizeBytes']);
	});

	it('is wired: each root field is bound to its method, the module provides the resolver, the plugin declares it', () => {
		for (const [type, names] of [
			['Query', QUERIES],
			['Mutation', MUTATIONS]
		] as const) {
			for (const name of names) {
				expect([name, typeof method(name)]).toEqual([name, 'function']);
				expect([name, Reflect.getMetadata('graphql:resolver_type', method(name))]).toEqual([name, type]);
				expect(Reflect.getMetadata('graphql:resolver_name', method(name))).toBe(name);
			}
		}
		expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, InboxEmailModule)).toContain(InboxEmailMessageResolver);
		const declared = (
			InboxEmailPlugin as unknown as { declared: { extensions: { schema: unknown; resolvers: unknown[] } } }
		).declared;
		expect(declared.extensions.resolvers).toContain(InboxEmailMessageResolver);
	});

	it('carries the controller’s guards, FEATURE_GRAPHQL and INBOX_VIEW (class and every field); ids through the UUID pipe', () => {
		const guards = (Reflect.getMetadata(GUARDS_METADATA, InboxEmailMessageResolver) as Array<{ name: string }>).map(
			(guard) => guard.name
		);
		expect(guards).toEqual(['TenantPermissionGuard', 'PermissionGuard', 'FeatureFlagGuard']);
		expect(Reflect.getMetadata('feature', InboxEmailMessageResolver)).toBe('FEATURE_GRAPHQL');
		expect(Reflect.getMetadata('permissions', InboxEmailMessageResolver)).toEqual([PermissionsEnum.INBOX_VIEW]);
		for (const name of [...QUERIES, ...MUTATIONS]) {
			expect([name, Reflect.getMetadata('permissions', method(name))]).toEqual([
				name,
				[PermissionsEnum.INBOX_VIEW]
			]);
		}
		for (const name of ['inboxEmail', 'inboxEmailThread', ...MUTATIONS]) {
			const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, InboxEmailMessageResolver, name) as Record<
				string,
				{ index: number; data: string; pipes: Array<{ name?: string }> }
			>;
			const id = Object.values(args).find((arg) => arg.index === 0);
			expect([name, id?.data, id?.pipes.map((pipe) => pipe.name)]).toEqual([name, 'id', ['UUIDValidationPipe']]);
		}
	});

	it('every field reaches the service method of its route, with the route DTO’s members only', async () => {
		const { emails, resolver } = setup();
		expect(await resolver.inboxEmail(EMAIL_ID)).toMatchObject({ id: EMAIL_ID, attachments: [] });
		expect(emails.get).toHaveBeenCalledWith(EMAIL_ID);
		await resolver.inboxEmailThread(EMAIL_ID);
		expect(emails.thread).toHaveBeenCalledWith(EMAIL_ID);
		await resolver.inboxQuarantinedEmails(MAILBOX_ID);
		expect(emails.quarantine).toHaveBeenCalledWith(MAILBOX_ID);

		await resolver.replyInboxEmail(EMAIL_ID, {
			text: 'Thanks',
			replyAll: true,
			cc: ['ada@example.com'],
			bcc: ['x']
		} as never);
		expect(emails.reply).toHaveBeenCalledWith(
			EMAIL_ID,
			Object.assign(new InboxEmailReplyDTO(), { text: 'Thanks', replyAll: true, cc: ['ada@example.com'] })
		);
		await resolver.forwardInboxEmail(EMAIL_ID, { to: ['eve@example.com'], includeAttachments: false });
		expect(emails.forward).toHaveBeenCalledWith(
			EMAIL_ID,
			Object.assign(new InboxEmailForwardDTO(), { to: ['eve@example.com'], includeAttachments: false })
		);
		expect(await resolver.releaseInboxEmail(EMAIL_ID)).toMatchObject({ id: EMAIL_ID });
		expect(emails.release).toHaveBeenCalledWith(EMAIL_ID);
	});

	it('the routes’ DTO rules refuse what the routes refuse, before the service', async () => {
		const { emails, resolver } = setup();
		const many = Array.from({ length: MAX_OUTBOUND_RECIPIENTS + 1 }, (_, i) => `r${i}@example.com`);
		const refused: Array<Promise<unknown>> = [
			resolver.inboxQuarantinedEmails('not-a-uuid'),
			resolver.replyInboxEmail(EMAIL_ID, {} as never),
			resolver.replyInboxEmail(EMAIL_ID, { text: 'x'.repeat(MAX_OUTBOUND_TEXT + 1) }),
			resolver.replyInboxEmail(EMAIL_ID, { text: 'hi', cc: ['not an address'] }),
			resolver.replyInboxEmail(EMAIL_ID, { text: 'hi', cc: many }),
			resolver.forwardInboxEmail(EMAIL_ID, {} as never),
			resolver.forwardInboxEmail(EMAIL_ID, { to: ['not an address'] }),
			resolver.forwardInboxEmail(EMAIL_ID, { to: many }),
			resolver.forwardInboxEmail(EMAIL_ID, { to: ['eve@example.com'], includeAttachments: 'yes' as never })
		];
		for (const attempt of refused) {
			await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
		}
		for (const name of ['quarantine', 'reply', 'forward'] as const) {
			expect([name, emails[name].mock.calls.length]).toEqual([name, 0]);
		}
	});
});
