import { randomUUID } from 'node:crypto';
import type { EverWorksHttpResponse } from '../client/ever-works-transport';
import { MockEverWorksExtension, MockEverWorksRouteContext, MockEverWorksServer } from './mock-ever-works.server';

/**
 * Works for the mock Ever Works API (contract v1 B.6; TEST CODE): `GET /works`, `GET /works/:id` and
 * the P2 create `POST /works` of a repo-less `project` work (EW-P2-4, CR-4). Like Ever Works, the
 * create answers `422 domain_rule` (`details.reason = 'project_works_disabled'`) until the kind is
 * switched on ({@link MockEverWorksWorks.projectWorksEnabled}, Ever Works' `EVER_WORKS_PROJECT_WORKS_ENABLED`),
 * refuses `private`, and answers a repeat of the same `externalRef` with the existing work (200).
 *
 * `new MockEverWorksWorks(mock)` adds its routes to the mock.
 */
export class MockEverWorksWorks {
	readonly works = new Map<string, Record<string, unknown>>();
	/** Ever Works' `EVER_WORKS_PROJECT_WORKS_ENABLED` (default off there too). */
	projectWorksEnabled = false;

	constructor(private readonly mock: MockEverWorksServer) {
		mock.extensions.push(this.route);
	}

	/**
	 * Adds (or replaces) a work (contract work DTO) of an organization and returns it. Its `externalLinks` are kept
	 * in the mock's own links, as Ever Works keeps them (`external_record_links`): the work serves them filtered to
	 * the caller's source, and `PUT` / `DELETE /links/work/:id` change them.
	 */
	addWork(organizationId: string, work: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
		const id = (work['id'] as string) ?? randomUUID();
		const given = (work['externalLinks'] as Array<Record<string, unknown>> | undefined) ?? [];
		for (let i = this.mock.links.length - 1; i >= 0; i--) {
			const link = this.mock.links[i];
			if (link && link.entityType === 'work' && link.entityId === id) this.mock.links.splice(i, 1);
		}
		for (const link of given) {
			this.mock.links.push({
				organizationId,
				entityType: 'work',
				entityId: id,
				source: (link['source'] as string) ?? 'gauzy',
				installationId: (link['installationId'] as string | null | undefined) ?? null,
				externalId: link['externalId'] as string,
				externalUrl: (link['externalUrl'] as string | null | undefined) ?? null
			});
		}
		const now = new Date().toISOString();
		const teamIds = (work['teamIds'] as string[]) ?? [];
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
			teamIds,
			name: 'Acme site',
			slug: `work-${id.slice(0, 6)}`,
			description: null,
			kind: 'website',
			status: 'active',
			website: null,
			repoUrls: [],
			members: [],
			webUrl: `https://app.example.test/works/${id}`,
			...work,
			externalLinks: []
		};
		this.works.set(id, row);
		return row;
	}

	/** A work as served: its `externalLinks` read from the mock's links, filtered to the caller's source. */
	private view(work: Record<string, unknown>, context: MockEverWorksRouteContext): Record<string, unknown> {
		const source = MockEverWorksServer.linkSource(context.key);
		const externalLinks = this.mock.links
			.filter((link) => link.entityType === 'work' && link.entityId === work['id'] && link.source === source)
			.map((link) => ({
				source: link.source,
				installationId: link.installationId,
				externalId: link.externalId,
				externalUrl: link.externalUrl
			}));
		return { ...work, externalLinks };
	}

	private readonly route: MockEverWorksExtension = (context) => {
		const { method, path } = context;
		if (path !== '/works' && !path.startsWith('/works/')) return null;
		if (method === 'GET' && path === '/works') {
			return (
				context.scoped('works:read') ??
				context.ok(MockEverWorksServer.page(this.visible(context), context.query))
			);
		}
		if (method === 'GET') {
			const denied = context.scoped('works:read');
			if (denied) return denied;
			const work = this.visible(context).find((row) => row['id'] === path.slice('/works/'.length));
			return work ? context.ok(work) : MockEverWorksServer.error(404, 'not_found', 'No such work.');
		}
		if (method === 'POST' && path === '/works') return context.scoped('works:write') ?? this.create(context);
		return MockEverWorksServer.error(404, 'not_found', `No route ${method} ${path}.`);
	};

	private visible(context: MockEverWorksRouteContext): Array<Record<string, unknown>> {
		return [...this.works.values()]
			.filter((work) => work['organizationId'] === context.org?.id && work['visibility'] !== 'private')
			.map((work) => this.view(work, context));
	}

	private create(context: MockEverWorksRouteContext): EverWorksHttpResponse {
		const input = (context.body ?? {}) as Record<string, unknown>;
		const allowed = new Set(['kind', 'name', 'description', 'website', 'teamIds', 'visibility', 'externalRef']);
		const unknown = Object.keys(input).filter((field) => !allowed.has(field));
		if (unknown.length)
			return MockEverWorksServer.error(400, 'validation_failed', `Unknown properties: ${unknown.join(', ')}.`);
		if (input['kind'] !== 'project')
			return MockEverWorksServer.error(
				400,
				'validation_failed',
				'Only kind "project" can be created through the integration API.'
			);
		const name = typeof input['name'] === 'string' ? input['name'].trim() : '';
		if (!name || name.length > 255)
			return MockEverWorksServer.error(400, 'validation_failed', 'name is required (at most 255 characters).');
		if (input['visibility'] === 'private')
			return MockEverWorksServer.error(422, 'domain_rule', 'An integration cannot create a private record.');
		if (!this.projectWorksEnabled) {
			return MockEverWorksServer.error(
				422,
				'domain_rule',
				'Project works are not enabled on this installation.',
				{ reason: 'project_works_disabled' }
			);
		}
		const ref = input['externalRef'] as
			| { source?: string; installationId?: string | null; externalId?: string; externalUrl?: string | null }
			| undefined;
		if (ref && ref.source !== 'gauzy')
			return MockEverWorksServer.error(
				400,
				'validation_failed',
				'externalRef.source must be the key\'s link source ("gauzy").'
			);
		if (ref?.externalId) {
			const existing = this.visible(context).find((work) =>
				((work['externalLinks'] as Array<Record<string, unknown>>) ?? []).some(
					(link) => link['source'] === ref.source && link['externalId'] === ref.externalId
				)
			);
			if (existing) return context.ok(existing, 200);
		}
		const teamIds = Array.isArray(input['teamIds']) ? (input['teamIds'] as string[]) : [];
		const actAs = context.headers['x-act-as-user'];
		const work = this.addWork(context.org?.id as string, {
			name,
			description: (input['description'] as string | null | undefined) ?? null,
			website: (input['website'] as string | null | undefined) ?? null,
			kind: 'project',
			status: 'active',
			teamIds,
			visibility: (input['visibility'] as string) ?? (teamIds.length ? 'team' : 'organization'),
			visibilityExplicit: input['visibility'] !== undefined,
			owner: actAs ? { type: 'user', id: actAs } : { type: 'integration', id: context.key.keyId },
			createdBy: actAs
				? { type: 'user', id: actAs, label: null }
				: { type: 'integration', id: context.key.keyId, label: context.key.keyName },
			members: actAs ? [{ userId: actAs, role: 'owner' }] : [],
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
		const served = this.view(work, context);
		void this.mock.emit({
			type: 'work.created',
			organizationId: context.org?.id as string,
			aggregate: { type: 'work', id: work['id'] as string, version: 1 },
			actor: actAs ? { type: 'user', id: actAs } : { type: 'integration', id: context.key.keyId },
			origin: { tag: context.headers['x-sync-origin'] ?? null, integrationKeyId: context.key.keyId },
			data: served
		});
		return context.ok(served, 201);
	}
}
