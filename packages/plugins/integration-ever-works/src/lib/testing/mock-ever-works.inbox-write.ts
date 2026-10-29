import { randomUUID } from 'node:crypto';
import type { EverWorksEventEnvelope } from '../client/ever-works-client.types';
import type { EverWorksHttpResponse } from '../client/ever-works-transport';
import { MockEverWorksExtension, MockEverWorksRouteContext, MockEverWorksServer } from './mock-ever-works.server';

const KINDS = ['notice', 'question', 'approval', 'mention', 'assignment', 'email', 'other'];
const STATES = ['open', 'resolved', 'archived'];

/**
 * The inbox write of the mock Ever Works API (contract v1 inbox write; TEST CODE): an integration files inbox items
 * for an Ever Works user and keeps them up to date.
 *
 * - `POST /inbox/items` (`inbox:write`): `{ externalId, recipientUserId, kind, title, body, sourceUrl?, sourceLabel?,
 *   related?, email?, choices?, occurredAt? }` → `201` with the item; the same `externalId` from the same key again
 *   answers `200` with the item filed before (nothing changes).
 * - `PATCH /inbox/items/:id` (`inbox:write`, `If-Match`): only an item the key filed (`404` otherwise); `{ title?, body?,
 *   choices?, state?, resolution? }`; a stale `If-Match` is `412 version_mismatch` with `details.current`.
 *
 * Writes record `inbox.item.created` / `inbox.item.updated` with the key's origin; the helpers below play an Ever
 * Works user (an answer, read, archive), whose `inbox.item.updated` carries no origin. `new MockEverWorksInboxWrite(mock)`
 * adds the routes, ahead of the mock's own inbox routes.
 */
export class MockEverWorksInboxWrite {
	/** The bodies `POST /inbox/items` received, in order. */
	readonly created: Array<Record<string, unknown>> = [];
	/** The bodies and `If-Match` headers `PATCH /inbox/items/:id` received, in order. */
	readonly patched: Array<{ id: string; ifMatch: string | null; body: Record<string, unknown> }> = [];

	constructor(private readonly mock: MockEverWorksServer) {
		mock.extensions.unshift(this.route);
	}

	/** The item an integration filed under an external id, or `undefined`. */
	byExternalId(externalId: string): Record<string, unknown> | undefined {
		return [...this.mock.inboxItems.values()].find((row) => row['externalId'] === externalId);
	}

	/** Every filed item (the ones a key created). */
	filed(): Array<Record<string, unknown>> {
		return [...this.mock.inboxItems.values()].filter((row) => typeof row['filedByKeyId'] === 'string');
	}

	/** An Ever Works user answers a filed item (a choice and / or text): `inbox.item.updated`, no origin. */
	answer(id: string, resolution: { choiceId?: string; text?: string }): Promise<EverWorksEventEnvelope> {
		const now = new Date().toISOString();
		return this.userChange(id, {
			status: 'answered',
			state: 'resolved',
			unread: false,
			answeredAt: now,
			answerOptionId: resolution.choiceId ?? null,
			answerText: resolution.text ?? null,
			resolution
		});
	}

	/** An Ever Works user reads (or marks unread) a filed item. */
	read(id: string, read = true): Promise<EverWorksEventEnvelope> {
		return this.userChange(id, { unread: !read });
	}

	/** An Ever Works user unarchives a filed item (answered again when it holds an answer, else open). */
	unarchive(id: string): Promise<EverWorksEventEnvelope> {
		const item = this.mock.inboxItems.get(id);
		const state = item?.['answeredAt'] ? 'resolved' : 'open';
		return this.userChange(id, { status: state === 'resolved' ? 'answered' : 'open', state });
	}

	/** An Ever Works user archives a filed item. */
	archive(id: string): Promise<EverWorksEventEnvelope> {
		return this.userChange(id, { status: 'archived', state: 'archived' });
	}

	private userChange(id: string, values: Record<string, unknown>): Promise<EverWorksEventEnvelope> {
		const item = this.mock.inboxItems.get(id);
		if (!item) throw new Error(`No inbox item ${id}.`);
		Object.assign(item, values, { version: Number(item['version']) + 1, updatedAt: new Date().toISOString() });
		return this.mock.emitInbox('inbox.item.updated', this.dto(item), null);
	}

	/** The item as the API answers it (the mock's own bookkeeping left out). */
	dto(item: Record<string, unknown>): Record<string, unknown> {
		return Object.fromEntries(Object.entries(item).filter(([field]) => field !== 'filedByKeyId'));
	}

	private readonly route: MockEverWorksExtension = (
		context: MockEverWorksRouteContext
	): EverWorksHttpResponse | null => {
		if (context.path === '/inbox/items' && context.method === 'POST') return this.create(context);
		const match = /^\/inbox\/items\/([^/]+)$/.exec(context.path);
		if (match && context.method === 'PATCH') return this.patch(context, decodeURIComponent(match[1]));
		return null;
	};

	private create(context: MockEverWorksRouteContext): EverWorksHttpResponse {
		const denied = context.scoped('inbox:write');
		if (denied) return denied;
		const body = (context.body ?? {}) as Record<string, unknown>;
		this.created.push(body);
		const invalid = this.invalid(body, true);
		if (invalid) return MockEverWorksServer.error(400, 'validation_failed', invalid);
		const replay = [...this.mock.inboxItems.values()].find(
			(row) => row['filedByKeyId'] === context.key.keyId && row['externalId'] === body['externalId']
		);
		if (replay) return context.ok(this.dto(replay), 200);
		const now = new Date().toISOString();
		const choices = (body['choices'] as Array<{ id: string; label: string }> | undefined) ?? null;
		const item: Record<string, unknown> = {
			id: randomUUID(),
			organizationId: context.org?.id ?? null,
			version: 1,
			createdAt: now,
			updatedAt: now,
			recipientUserId: body['recipientUserId'],
			kind: body['kind'],
			title: body['title'],
			body: body['body'],
			options: choices,
			choices,
			sourceType: 'integration',
			status: 'open',
			state: 'open',
			unread: true,
			answeredAt: null,
			answerText: null,
			answerOptionId: null,
			resolution: null,
			agentId: null,
			agentRunId: null,
			taskId: (body['related'] as { taskId?: string } | undefined)?.taskId ?? null,
			workId: (body['related'] as { workId?: string } | undefined)?.workId ?? null,
			escalationId: null,
			proposalId: null,
			externalId: body['externalId'],
			sourceUrl: body['sourceUrl'] ?? null,
			sourceLabel: body['sourceLabel'] ?? null,
			related: body['related'] ?? null,
			email: body['email'] ?? null,
			occurredAt: body['occurredAt'] ?? now,
			filedByKeyId: context.key.keyId
		};
		this.mock.inboxItems.set(item['id'] as string, item);
		void this.mock.emitInbox('inbox.item.created', this.dto(item), {
			tag: context.headers['x-sync-origin'] ?? null
		});
		return context.ok(this.dto(item), 201);
	}

	private patch(context: MockEverWorksRouteContext, id: string): EverWorksHttpResponse {
		const denied = context.scoped('inbox:write');
		if (denied) return denied;
		const item = this.mock.inboxItems.get(id);
		if (!item || item['organizationId'] !== context.org?.id || item['filedByKeyId'] !== context.key.keyId) {
			return MockEverWorksServer.error(404, 'not_found', 'No inbox item this key filed.');
		}
		const body = (context.body ?? {}) as Record<string, unknown>;
		const raw = context.headers['if-match'] ?? null;
		this.patched.push({ id, ifMatch: raw, body });
		if (raw !== null) {
			const expected = Number(String(raw).replace(/"/g, ''));
			if (expected !== Number(item['version'])) {
				return MockEverWorksServer.error(
					412,
					'version_mismatch',
					`If-Match "${expected}" does not match the current version "${item['version']}".`,
					{ expected, current: item['version'] }
				);
			}
		}
		const invalid = this.invalid(body, false);
		if (invalid) return MockEverWorksServer.error(400, 'validation_failed', invalid);
		for (const field of ['title', 'body']) if (typeof body[field] === 'string') item[field] = body[field];
		if (Array.isArray(body['choices'])) Object.assign(item, { choices: body['choices'], options: body['choices'] });
		if (typeof body['state'] === 'string') {
			item['state'] = body['state'];
			item['status'] = body['state'] === 'resolved' ? 'answered' : body['state'];
			if (body['state'] === 'resolved') {
				const resolution = (body['resolution'] ?? null) as { choiceId?: string; text?: string } | null;
				Object.assign(item, {
					resolution,
					answeredAt: new Date().toISOString(),
					answerOptionId: resolution?.choiceId ?? null,
					answerText: resolution?.text ?? null
				});
			}
		}
		Object.assign(item, { version: Number(item['version']) + 1, updatedAt: new Date().toISOString() });
		void this.mock.emitInbox('inbox.item.updated', this.dto(item), {
			tag: context.headers['x-sync-origin'] ?? null
		});
		return context.ok(this.dto(item));
	}

	/** Why a body breaks the contract's limits, or `null`. */
	private invalid(body: Record<string, unknown>, create: boolean): string | null {
		const text = (field: string, max: number, required: boolean) => {
			const value = body[field];
			if (value === undefined) return required ? `${field} is required.` : null;
			return typeof value === 'string' && value.length <= max
				? null
				: `${field} must be a string of at most ${max}.`;
		};
		const errors = create
			? [
					text('externalId', 128, true),
					text('recipientUserId', 64, true),
					KINDS.includes(String(body['kind'])) ? null : 'kind is not one of the inbox kinds.',
					text('title', 300, true),
					text('body', 20_000, true),
					body['email'] !== undefined && body['kind'] !== 'email' ? 'email is only for kind email.' : null,
					body['choices'] !== undefined && !['question', 'approval'].includes(String(body['kind']))
						? 'choices are only for questions and approvals.'
						: null
				]
			: [
					text('title', 300, false),
					text('body', 20_000, false),
					body['state'] !== undefined && !STATES.includes(String(body['state']))
						? 'state is not one of open, resolved, archived.'
						: null
				];
		const choices = body['choices'];
		if (choices !== undefined && (!Array.isArray(choices) || choices.length > 10))
			errors.push('choices are at most 10.');
		return errors.find((error) => error !== null) ?? null;
	}
}
