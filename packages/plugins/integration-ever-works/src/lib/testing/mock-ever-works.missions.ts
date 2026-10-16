import { randomUUID } from 'node:crypto';
import type { EverWorksHttpResponse } from '../client/ever-works-transport';
import { MockEverWorksExtension, MockEverWorksRouteContext, MockEverWorksServer } from './mock-ever-works.server';

/**
 * Missions for the mock Ever Works API (contract v1 B.6 + CR-7, EW-P2-5; TEST CODE): `GET /missions`,
 * `GET /missions/:id`, `POST /missions` (always `paused`; `externalRef` repeat → 200 existing), `PATCH
 * /missions/:id` (never `active` → 422), `PUT /missions/:id/works` and `PUT /missions/:id/goals` (at most
 * one primary). `If-Match` → 412. Writes act as the mission's owner: another user's mission answers 404.
 *
 * `new MockEverWorksMissions(mock)` adds its routes to the mock.
 */
export class MockEverWorksMissions {
	readonly missions = new Map<string, Record<string, unknown>>();

	constructor(private readonly mock: MockEverWorksServer) {
		mock.extensions.push(this.route);
	}

	/** Adds (or replaces) a mission (CR-7 mission DTO) of an organization and returns it. */
	addMission(organizationId: string, mission: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
		const id = (mission['id'] as string) ?? randomUUID();
		const now = new Date().toISOString();
		const teamIds = (mission['teamIds'] as string[]) ?? [];
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
			title: 'Win the SMB market',
			description: 'Grow SMB revenue.',
			type: 'one-shot',
			status: 'active',
			outcome: null,
			schedule: null,
			autoBuildWorks: false,
			works: [],
			goals: [],
			webUrl: `https://app.example.test/missions/${id}`,
			...mission
		};
		this.missions.set(id, row);
		return row;
	}

	private readonly route: MockEverWorksExtension = (context) => {
		const { method, path } = context;
		if (path !== '/missions' && !path.startsWith('/missions/')) return null;
		const parts = path.split('/').filter(Boolean); // ['missions', id?, set?]
		if (method === 'GET' && parts.length === 1)
			return (
				context.scoped('missions:read') ??
				context.ok(MockEverWorksServer.page(this.visible(context), context.query))
			);
		if (method === 'GET' && parts.length === 2) {
			const denied = context.scoped('missions:read');
			if (denied) return denied;
			const mission = this.find(context, parts[1]);
			return mission ? context.ok(mission) : MockEverWorksServer.error(404, 'not_found', 'No such mission.');
		}
		const denied = context.scoped('missions:write');
		if (denied) return denied;
		if (method === 'POST' && parts.length === 1) return this.create(context);
		const mission = this.find(context, parts[1]);
		const actor = context.headers['x-act-as-user'];
		const owner = mission?.['owner'] as { type: string; id: string } | undefined;
		const owned =
			!!mission &&
			(actor
				? owner?.type === 'user' && owner.id === actor
				: owner?.type === 'integration' && owner.id === context.key.keyId);
		if (!mission || !owned) return MockEverWorksServer.error(404, 'not_found', 'No such mission.');
		const ifMatch = context.headers['if-match'];
		if (ifMatch && ifMatch.replace(/"/g, '') !== String(mission['version']))
			return MockEverWorksServer.error(412, 'version_mismatch', 'The mission changed.');
		const input = (context.body ?? {}) as Record<string, unknown>;
		if (method === 'PATCH' && parts.length === 2) {
			const allowed = new Set(['title', 'description', 'teamIds', 'visibility', 'status', 'outcome']);
			const refused = Object.keys(input).filter((field) => !allowed.has(field));
			if (refused.length || !Object.keys(input).length)
				return MockEverWorksServer.error(
					400,
					'validation_failed',
					`Not writable: ${refused.join(', ') || 'empty body'}.`
				);
			if (input['status'] === 'active')
				return MockEverWorksServer.error(422, 'domain_rule', 'An integration never activates a mission.');
			return this.bump(context, mission, input, input['status'] ? 'mission.status_changed' : 'mission.updated');
		}
		if (method === 'PUT' && parts[2] === 'works')
			return this.bump(context, mission, { works: (input['works'] as unknown[]) ?? [] }, 'mission.updated');
		if (method === 'PUT' && parts[2] === 'goals') {
			const goals = (input['goals'] as Array<Record<string, unknown>>) ?? [];
			if (goals.filter((g) => g['isPrimary']).length > 1)
				return MockEverWorksServer.error(422, 'domain_rule', 'A mission has at most one primary goal.');
			return this.bump(context, mission, { goals }, 'mission.updated');
		}
		return MockEverWorksServer.error(404, 'not_found', `No route ${method} ${path}.`);
	};

	private visible(context: MockEverWorksRouteContext): Array<Record<string, unknown>> {
		return [...this.missions.values()].filter(
			(mission) => mission['organizationId'] === context.org?.id && mission['visibility'] !== 'private'
		);
	}

	private find(context: MockEverWorksRouteContext, id: string | undefined): Record<string, unknown> | undefined {
		return this.visible(context).find((mission) => mission['id'] === id);
	}

	private create(context: MockEverWorksRouteContext): EverWorksHttpResponse {
		const input = (context.body ?? {}) as Record<string, unknown>;
		const allowed = new Set(['title', 'description', 'type', 'schedule', 'teamIds', 'visibility', 'externalRef']);
		const refused = Object.keys(input).filter((field) => !allowed.has(field));
		if (refused.length)
			return MockEverWorksServer.error(400, 'validation_failed', `Unknown properties: ${refused.join(', ')}.`);
		const title = typeof input['title'] === 'string' ? input['title'] : '';
		const description = typeof input['description'] === 'string' ? input['description'] : '';
		if (!title || title.length > 200 || !description)
			return MockEverWorksServer.error(400, 'validation_failed', 'title (1..200) and description are required.');
		if (input['visibility'] === 'private')
			return MockEverWorksServer.error(422, 'domain_rule', 'An integration cannot create a private record.');
		const ref = input['externalRef'] as
			| { source?: string; installationId?: string | null; externalId?: string; externalUrl?: string | null }
			| undefined;
		if (ref && ref.source !== 'gauzy')
			return MockEverWorksServer.error(400, 'validation_failed', 'externalRef.source must be "gauzy".');
		if (ref?.externalId) {
			const existing = this.visible(context).find((mission) =>
				((mission['externalLinks'] as Array<Record<string, unknown>>) ?? []).some(
					(link) => link['source'] === ref.source && link['externalId'] === ref.externalId
				)
			);
			if (existing) return context.ok(existing, 200);
		}
		const actAs = context.headers['x-act-as-user'];
		const teamIds = Array.isArray(input['teamIds']) ? (input['teamIds'] as string[]) : [];
		const mission = this.addMission(context.org?.id as string, {
			title,
			description,
			type: (input['type'] as string) ?? 'one-shot',
			teamIds,
			visibility: (input['visibility'] as string) ?? (teamIds.length ? 'team' : 'organization'),
			status: 'paused',
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
		this.emit(context, 'mission.created', mission);
		return context.ok(mission, 201);
	}

	private bump(
		context: MockEverWorksRouteContext,
		mission: Record<string, unknown>,
		changes: Record<string, unknown>,
		type: string
	): EverWorksHttpResponse {
		Object.assign(mission, changes, {
			version: Number(mission['version']) + 1,
			updatedAt: new Date().toISOString()
		});
		this.emit(context, type, mission);
		return context.ok(mission);
	}

	private emit(context: MockEverWorksRouteContext, type: string, mission: Record<string, unknown>): void {
		const actAs = context.headers['x-act-as-user'];
		void this.mock.emit({
			type,
			organizationId: context.org?.id as string,
			aggregate: { type: 'mission', id: mission['id'] as string, version: Number(mission['version']) },
			actor: actAs ? { type: 'user', id: actAs } : { type: 'integration', id: context.key.keyId },
			origin: { tag: context.headers['x-sync-origin'] ?? null, integrationKeyId: context.key.keyId },
			data: { ...mission }
		});
	}
}
