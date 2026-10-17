import { randomUUID } from 'node:crypto';
import type { EverWorksHttpResponse } from '../client/ever-works-transport';
import { MockEverWorksExtension, MockEverWorksRouteContext, MockEverWorksServer } from './mock-ever-works.server';

/**
 * Agent email for the mock Ever Works API (contract v1 CR-11, EW-P4-1; TEST CODE): `POST /email/inbound`
 * (`email:write`): stores the mail as an inbound message of the agent and "dispatches" it (task-spawn), `201
 * {message, dispatch}`; a repeated Message-ID from the same key into the same organization answers `200` with the
 * message already delivered; an agent unknown to the organization answers `404`, one without an inbound assignment
 * `422 domain_rule`. `Idempotency-Key` is required (`400` without), as the contract says.
 *
 * `new MockEverWorksEmail(mock)` adds its routes to the mock.
 */
export class MockEverWorksEmail {
	/** Every stored message (contract `email-message.schema.json`), by id. */
	readonly messages = new Map<string, Record<string, unknown>>();
	/** The agents that have an active inbound assignment (the owner's opt-in). */
	readonly inboundAgents = new Set<string>();
	/** The bodies `POST /email/inbound` received, in order. */
	readonly received: unknown[] = [];

	constructor(private readonly mock: MockEverWorksServer) {
		mock.extensions.push(this.route);
	}

	private readonly route: MockEverWorksExtension = (context: MockEverWorksRouteContext): EverWorksHttpResponse | null => {
		if (context.path !== '/email/inbound') return null;
		if (context.method !== 'POST') return MockEverWorksServer.error(404, 'not_found', `No route ${context.method} ${context.path}.`);
		const denied = context.scoped('email:write');
		if (denied) return denied;
		if (!context.headers['idempotency-key']) {
			return MockEverWorksServer.error(400, 'validation_failed', 'Idempotency-Key is required.');
		}
		const body = (context.body ?? {}) as { agentId?: string; message?: Record<string, unknown> };
		this.received.push(body);
		const agent = body.agentId ? this.mock.agents.get(body.agentId) : undefined;
		if (!agent || agent['organizationId'] !== context.org?.id) {
			return MockEverWorksServer.error(404, 'not_found', 'No such agent.');
		}
		if (!this.inboundAgents.has(body.agentId as string)) {
			return MockEverWorksServer.error(422, 'domain_rule', 'The agent has no active inbound assignment.', { rule: 'no_inbound_assignment' });
		}
		const input = body.message ?? {};
		const messageId = (input['messageId'] as string | null) ?? null;
		const repeat = messageId
			? [...this.messages.values()].find(
					(row) => row['messageId'] === messageId && row['organizationId'] === context.org?.id && row['keyId'] === context.key.keyId
				)
			: undefined;
		if (repeat) return context.ok({ message: this.dto(repeat), dispatch: repeat['dispatch'] }, 200);
		const now = new Date().toISOString();
		const taskId = randomUUID();
		const row: Record<string, unknown> = {
			id: randomUUID(),
			organizationId: context.org?.id ?? null,
			version: 1,
			createdAt: now,
			updatedAt: now,
			ownerUserId: (agent['owner'] as { id?: string } | undefined)?.id ?? null,
			agentId: body.agentId,
			taskId,
			conversationId: null,
			direction: 'inbound',
			status: 'received',
			deliveryStatus: 'delivered',
			from: input['from'],
			to: input['to'] ?? [],
			cc: input['cc'] ?? [],
			subject: input['subject'],
			text: input['text'] ?? null,
			html: input['html'] ?? null,
			messageId,
			inReplyTo: input['inReplyTo'] ?? null,
			references: input['references'] ?? [],
			attachments: input['attachments'] ?? [],
			sentAt: null,
			receivedAt: now,
			webUrl: null,
			keyId: context.key.keyId,
			dispatch: { mode: 'task-spawn', taskId, conversationId: null, threaded: false }
		};
		this.messages.set(row['id'] as string, row);
		return context.ok({ message: this.dto(row), dispatch: row['dispatch'] }, 201);
	};

	/** The DTO of a stored message (the mock's own bookkeeping left out). */
	private dto(row: Record<string, unknown>): Record<string, unknown> {
		const { keyId: _keyId, dispatch: _dispatch, ...dto } = row;
		return dto;
	}
}
