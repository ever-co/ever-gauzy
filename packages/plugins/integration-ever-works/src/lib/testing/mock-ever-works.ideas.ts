import { randomUUID } from 'node:crypto';
import type { EverWorksHttpResponse } from '../client/ever-works-transport';
import { MockEverWorksExtension, MockEverWorksRouteContext, MockEverWorksServer } from './mock-ever-works.server';

/**
 * Ideas for the mock Ever Works API (contract v1 B.6 + CR-5, EW-P2-1; TEST CODE): `GET /ideas`,
 * `GET /ideas/:id`, `POST /ideas` (always `source: 'external'`, `status: 'pending'`; `externalRef`
 * repeat → 200 with the existing idea), `PATCH /ideas/:id` (title, description, teamIds, visibility;
 * `If-Match` → 412), `POST /ideas/:id/dismiss` (pending → dismissed) and `/restore` (dismissed →
 * pending), idempotent, any other status → `422 domain_rule` with `details.status`. Writes act as the
 * idea's owner: another user's idea answers `404`.
 *
 * `new MockEverWorksIdeas(mock)` adds its routes to the mock.
 */
export class MockEverWorksIdeas {
	readonly ideas = new Map<string, Record<string, unknown>>();

	constructor(private readonly mock: MockEverWorksServer) {
		mock.extensions.push(this.route);
	}

	/** Adds (or replaces) an idea (contract idea DTO) of an organization and returns it. */
	addIdea(organizationId: string, idea: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
		const id = (idea['id'] as string) ?? randomUUID();
		const now = new Date().toISOString();
		const teamIds = (idea['teamIds'] as string[]) ?? [];
		const row = {
			id,
			organizationId,
			version: 1,
			createdAt: now,
			updatedAt: now,
			visibility: teamIds.length ? 'team' : 'organization',
			visibilityExplicit: false,
			owner: { type: 'user', id: randomUUID() },
			createdBy: { type: 'user', id: randomUUID(), label: 'owner' },
			externalLinks: [],
			teamIds,
			title: 'Customer portal',
			description: 'A self-service portal.',
			status: 'pending',
			source: 'user-manual',
			missionId: null,
			targetWorkId: null,
			acceptedWorkId: null,
			failureMessage: null,
			webUrl: `https://app.example.test/ideas/${id}`,
			...idea
		};
		this.ideas.set(id, row);
		return row;
	}

	private readonly route: MockEverWorksExtension = (context) => {
		const { method, path } = context;
		if (path !== '/ideas' && !path.startsWith('/ideas/')) return null;
		const parts = path.split('/').filter(Boolean); // ['ideas', id?, action?]
		if (method === 'GET' && parts.length === 1)
			return (
				context.scoped('ideas:read') ??
				context.ok(MockEverWorksServer.page(this.visible(context), context.query))
			);
		if (method === 'GET' && parts.length === 2) {
			const denied = context.scoped('ideas:read');
			if (denied) return denied;
			const idea = this.find(context, parts[1]);
			return idea ? context.ok(idea) : MockEverWorksServer.error(404, 'not_found', 'No such idea.');
		}
		const denied = context.scoped('ideas:write');
		if (denied) return denied;
		if (method === 'POST' && parts.length === 1) return this.create(context);
		const idea = this.find(context, parts[1]);
		// Writes act as the idea's owner: the act-as user, or the key's own (integration-owned) ideas.
		const actor = context.headers['x-act-as-user'];
		const owner = idea?.['owner'] as { type: string; id: string } | undefined;
		const owned =
			!!idea &&
			(actor
				? owner?.type === 'user' && owner.id === actor
				: owner?.type === 'integration' && owner.id === context.key.keyId);
		if (!idea || !owned) return MockEverWorksServer.error(404, 'not_found', 'No such idea.');
		if (method === 'PATCH' && parts.length === 2) return this.update(context, idea);
		if (method === 'POST' && parts.length === 3 && (parts[2] === 'dismiss' || parts[2] === 'restore'))
			return this.move(context, idea, parts[2]);
		return MockEverWorksServer.error(404, 'not_found', `No route ${method} ${path}.`);
	};

	private visible(context: MockEverWorksRouteContext): Array<Record<string, unknown>> {
		return [...this.ideas.values()].filter(
			(idea) => idea['organizationId'] === context.org?.id && idea['visibility'] !== 'private'
		);
	}

	private find(context: MockEverWorksRouteContext, id: string | undefined): Record<string, unknown> | undefined {
		return this.visible(context).find((idea) => idea['id'] === id);
	}

	private create(context: MockEverWorksRouteContext): EverWorksHttpResponse {
		const input = (context.body ?? {}) as Record<string, unknown>;
		const allowed = new Set(['title', 'description', 'missionId', 'teamIds', 'visibility', 'externalRef']);
		const unknown = Object.keys(input).filter((field) => !allowed.has(field));
		if (unknown.length)
			return MockEverWorksServer.error(400, 'validation_failed', `Unknown properties: ${unknown.join(', ')}.`);
		const title = typeof input['title'] === 'string' ? input['title'] : '';
		const description = typeof input['description'] === 'string' ? input['description'] : '';
		if (!title || title.length > 120)
			return MockEverWorksServer.error(400, 'validation_failed', 'title is 1 to 120 characters.');
		if (!description) return MockEverWorksServer.error(400, 'validation_failed', 'description is required.');
		if (input['visibility'] === 'private')
			return MockEverWorksServer.error(422, 'domain_rule', 'An integration cannot create a private record.');
		const ref = input['externalRef'] as
			| { source?: string; installationId?: string | null; externalId?: string; externalUrl?: string | null }
			| undefined;
		if (ref && ref.source !== 'gauzy')
			return MockEverWorksServer.error(400, 'validation_failed', 'externalRef.source must be "gauzy".');
		if (ref?.externalId) {
			const existing = this.visible(context).find((idea) =>
				((idea['externalLinks'] as Array<Record<string, unknown>>) ?? []).some(
					(link) => link['source'] === ref.source && link['externalId'] === ref.externalId
				)
			);
			if (existing) return context.ok(existing, 200);
		}
		const actAs = context.headers['x-act-as-user'];
		const teamIds = Array.isArray(input['teamIds']) ? (input['teamIds'] as string[]) : [];
		const idea = this.addIdea(context.org?.id as string, {
			title,
			description,
			teamIds,
			visibility: (input['visibility'] as string) ?? (teamIds.length ? 'team' : 'organization'),
			missionId: (input['missionId'] as string | null | undefined) ?? null,
			source: 'external',
			status: 'pending',
			owner: actAs ? { type: 'user', id: actAs } : { type: 'integration', id: context.key.keyId },
			createdBy: actAs
				? { type: 'user', id: actAs, label: null }
				: { type: 'integration', id: context.key.keyId, label: context.key.keyName },
			externalLinks: ref?.externalId
				? [
						{
							source: ref.source,
							installationId: ref.installationId ?? null,
							externalId: ref.externalId,
							externalUrl: ref.externalUrl ?? null
						}
					]
				: []
		});
		this.emit(context, 'idea.created', idea);
		return context.ok(idea, 201);
	}

	private update(context: MockEverWorksRouteContext, idea: Record<string, unknown>): EverWorksHttpResponse {
		const ifMatch = context.headers['if-match'];
		if (ifMatch && ifMatch.replace(/"/g, '') !== String(idea['version']))
			return MockEverWorksServer.error(412, 'version_mismatch', 'The idea changed.');
		const input = (context.body ?? {}) as Record<string, unknown>;
		const allowed = new Set(['title', 'description', 'teamIds', 'visibility']);
		const unknown = Object.keys(input).filter((field) => !allowed.has(field));
		if (unknown.length || !Object.keys(input).length)
			return MockEverWorksServer.error(
				400,
				'validation_failed',
				'Only title, description, teamIds and visibility can change.'
			);
		if (input['visibility'] === 'private')
			return MockEverWorksServer.error(422, 'domain_rule', 'An integration cannot make a record private.');
		Object.assign(idea, input, { version: Number(idea['version']) + 1, updatedAt: new Date().toISOString() });
		if (input['teamIds'] && input['visibility'] === undefined && !idea['visibilityExplicit'])
			idea['visibility'] = (input['teamIds'] as string[]).length ? 'team' : 'organization';
		this.emit(context, 'idea.updated', idea);
		return context.ok(idea);
	}

	private move(
		context: MockEverWorksRouteContext,
		idea: Record<string, unknown>,
		action: 'dismiss' | 'restore'
	): EverWorksHttpResponse {
		const [from, to] = action === 'dismiss' ? ['pending', 'dismissed'] : ['dismissed', 'pending'];
		if (idea['status'] === to) return context.ok(idea);
		if (idea['status'] !== from)
			return MockEverWorksServer.error(
				422,
				'domain_rule',
				`Only a ${from} idea can be ${action === 'dismiss' ? 'dismissed' : 'restored'}.`,
				{ status: idea['status'] }
			);
		Object.assign(idea, { status: to, version: Number(idea['version']) + 1, updatedAt: new Date().toISOString() });
		this.emit(context, 'idea.status_changed', idea);
		return context.ok(idea);
	}

	private emit(context: MockEverWorksRouteContext, type: string, idea: Record<string, unknown>): void {
		const actAs = context.headers['x-act-as-user'];
		void this.mock.emit({
			type,
			organizationId: context.org?.id as string,
			aggregate: { type: 'idea', id: idea['id'] as string, version: Number(idea['version']) },
			actor: actAs ? { type: 'user', id: actAs } : { type: 'integration', id: context.key.keyId },
			origin: { tag: context.headers['x-sync-origin'] ?? null, integrationKeyId: context.key.keyId },
			data: { ...idea }
		});
	}
}
