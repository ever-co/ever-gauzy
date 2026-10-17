import { randomUUID } from 'node:crypto';
import type { EverWorksHttpResponse } from '../client/ever-works-transport';
import { MockEverWorksExtension, MockEverWorksRouteContext, MockEverWorksServer } from './mock-ever-works.server';

/**
 * Goals for the mock Ever Works API (contract v1 B.6, EW-P2-2; TEST CODE): `GET /goals`, `GET /goals/:id`,
 * `POST /goals` (always `draft`; a metric goal reads the external source, any other source → 422;
 * `externalRef` repeat → 200 existing), `PATCH /goals/:id` (no status, outcome, source or kind → 400),
 * `PUT /goals/:id/criteria`, `PUT /goals/:id/dod` and `POST /goals/:id/samples` (the goal's metric or
 * one criterion; never changes the status). `If-Match` → 412. Writes act as the goal's owner: another
 * user's goal answers `404`.
 *
 * `new MockEverWorksGoals(mock)` adds its routes to the mock.
 */
export class MockEverWorksGoals {
	readonly goals = new Map<string, Record<string, unknown>>();
	readonly samples: Array<{ goalId: string; criterionId: string | null; value: number; sampledAt: string }> = [];

	constructor(private readonly mock: MockEverWorksServer) {
		mock.extensions.push(this.route);
	}

	/** Adds (or replaces) a goal (contract goal DTO) of an organization and returns it. */
	addGoal(organizationId: string, goal: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
		const id = (goal['id'] as string) ?? randomUUID();
		const now = new Date().toISOString();
		const teamIds = (goal['teamIds'] as string[]) ?? [];
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
			title: 'Grow paying customers',
			description: null,
			goalKind: 'metric',
			status: 'draft',
			outcome: null,
			metricSource: { pluginId: 'external', metricId: 'value' },
			comparator: 'gte',
			targetValue: 120,
			unit: 'customers',
			window: 'point',
			baselineValue: 80,
			currentValue: null,
			currentValueAt: null,
			deadline: null,
			criteria: null,
			resolvedScore: null,
			dodCriteria: null,
			progress: 0,
			missionIds: [],
			primaryMissionId: null,
			assignedAgentId: null,
			activeAgentId: null,
			loop: { status: null, iteration: 0, spentCents: 0 },
			archivedAt: null,
			webUrl: `https://app.example.test/goals/${id}`,
			...goal
		};
		this.goals.set(id, row);
		return row;
	}

	private readonly route: MockEverWorksExtension = (context) => {
		const { method, path } = context;
		if (path !== '/goals' && !path.startsWith('/goals/')) return null;
		const parts = path.split('/').filter(Boolean); // ['goals', id?, action?]
		if (method === 'GET' && parts.length === 1)
			return (
				context.scoped('goals:read') ??
				context.ok(MockEverWorksServer.page(this.visible(context), context.query))
			);
		if (method === 'GET' && parts.length === 2) {
			const denied = context.scoped('goals:read');
			if (denied) return denied;
			const goal = this.find(context, parts[1]);
			return goal ? context.ok(goal) : MockEverWorksServer.error(404, 'not_found', 'No such goal.');
		}
		const denied = context.scoped('goals:write');
		if (denied) return denied;
		if (method === 'POST' && parts.length === 1) return this.create(context);
		const goal = this.find(context, parts[1]);
		const actor = context.headers['x-act-as-user'];
		const owner = goal?.['owner'] as { type: string; id: string } | undefined;
		const owned =
			!!goal &&
			(actor
				? owner?.type === 'user' && owner.id === actor
				: owner?.type === 'integration' && owner.id === context.key.keyId);
		if (!goal || !owned) return MockEverWorksServer.error(404, 'not_found', 'No such goal.');
		const ifMatch = context.headers['if-match'];
		if (ifMatch && method !== 'POST' && ifMatch.replace(/"/g, '') !== String(goal['version']))
			return MockEverWorksServer.error(412, 'version_mismatch', 'The goal changed.');
		const input = (context.body ?? {}) as Record<string, unknown>;
		if (method === 'PATCH' && parts.length === 2) {
			const allowed = new Set([
				'title',
				'description',
				'comparator',
				'targetValue',
				'unit',
				'window',
				'baselineValue',
				'deadline',
				'teamIds',
				'visibility'
			]);
			const refused = Object.keys(input).filter((field) => !allowed.has(field));
			if (refused.length || !Object.keys(input).length)
				return MockEverWorksServer.error(
					400,
					'validation_failed',
					`Not writable: ${refused.join(', ') || 'empty body'}.`
				);
			return this.bump(context, goal, input, 'goal.updated');
		}
		if (method === 'PUT' && parts[2] === 'criteria') {
			if (goal['goalKind'] !== 'metric')
				return MockEverWorksServer.error(400, 'validation_failed', 'A delivery goal has no criteria.');
			return this.bump(context, goal, { criteria: (input['criteria'] as unknown[]) ?? [] }, 'goal.updated');
		}
		if (method === 'PUT' && parts[2] === 'dod') {
			const items = ((input['dodCriteria'] as Array<Record<string, unknown>>) ?? []).map((item) => ({
				...item,
				source: 'operator'
			}));
			if (goal['goalKind'] === 'delivery' && !items.length)
				return MockEverWorksServer.error(
					422,
					'domain_rule',
					'A delivery goal keeps one Definition-of-Done item.'
				);
			return this.bump(context, goal, { dodCriteria: items }, 'goal.updated');
		}
		if (method === 'POST' && parts[2] === 'samples') return this.sample(context, goal, input);
		return MockEverWorksServer.error(404, 'not_found', `No route ${method} ${path}.`);
	};

	private visible(context: MockEverWorksRouteContext): Array<Record<string, unknown>> {
		return [...this.goals.values()].filter(
			(goal) => goal['organizationId'] === context.org?.id && goal['visibility'] !== 'private'
		);
	}

	private find(context: MockEverWorksRouteContext, id: string | undefined): Record<string, unknown> | undefined {
		return this.visible(context).find((goal) => goal['id'] === id);
	}

	private create(context: MockEverWorksRouteContext): EverWorksHttpResponse {
		const input = (context.body ?? {}) as Record<string, unknown>;
		const allowed = new Set([
			'title',
			'description',
			'goalKind',
			'metricSource',
			'comparator',
			'targetValue',
			'unit',
			'window',
			'baselineValue',
			'deadline',
			'criteria',
			'dodCriteria',
			'teamIds',
			'visibility',
			'externalRef'
		]);
		const refused = Object.keys(input).filter((field) => !allowed.has(field));
		if (refused.length)
			return MockEverWorksServer.error(400, 'validation_failed', `Unknown properties: ${refused.join(', ')}.`);
		const title = typeof input['title'] === 'string' ? input['title'] : '';
		if (!title || title.length > 200)
			return MockEverWorksServer.error(400, 'validation_failed', 'title is 1 to 200 characters.');
		const kind = (input['goalKind'] as string) ?? 'metric';
		const source = input['metricSource'] as { pluginId?: string } | undefined;
		if (source && source.pluginId !== 'external')
			return MockEverWorksServer.error(
				422,
				'domain_rule',
				'An integration may only use the external metric source.'
			);
		if (
			kind === 'metric' &&
			(input['comparator'] === undefined || input['targetValue'] === undefined || !input['unit'])
		) {
			return MockEverWorksServer.error(
				400,
				'validation_failed',
				'A metric goal needs comparator, targetValue and unit.'
			);
		}
		if (kind === 'delivery' && !((input['dodCriteria'] as unknown[]) ?? []).length)
			return MockEverWorksServer.error(
				400,
				'validation_failed',
				'A delivery goal needs a Definition-of-Done item.'
			);
		if (input['visibility'] === 'private')
			return MockEverWorksServer.error(422, 'domain_rule', 'An integration cannot create a private record.');
		const ref = input['externalRef'] as
			| { source?: string; installationId?: string | null; externalId?: string; externalUrl?: string | null }
			| undefined;
		if (ref && ref.source !== 'gauzy')
			return MockEverWorksServer.error(400, 'validation_failed', 'externalRef.source must be "gauzy".');
		if (ref?.externalId) {
			const existing = this.visible(context).find((goal) =>
				((goal['externalLinks'] as Array<Record<string, unknown>>) ?? []).some(
					(link) => link['source'] === ref.source && link['externalId'] === ref.externalId
				)
			);
			if (existing) return context.ok(existing, 200);
		}
		const actAs = context.headers['x-act-as-user'];
		const teamIds = Array.isArray(input['teamIds']) ? (input['teamIds'] as string[]) : [];
		const goal = this.addGoal(context.org?.id as string, {
			...Object.fromEntries(Object.entries(input).filter(([field]) => field !== 'externalRef')),
			goalKind: kind,
			status: 'draft',
			metricSource: kind === 'metric' ? { pluginId: 'external', metricId: 'value' } : null,
			...(kind === 'delivery' ? { comparator: null, targetValue: null, unit: null, baselineValue: null } : {}),
			dodCriteria: ((input['dodCriteria'] as Array<Record<string, unknown>>) ?? []).map((item) => ({
				...item,
				source: 'operator'
			})),
			teamIds,
			visibility: (input['visibility'] as string) ?? (teamIds.length ? 'team' : 'organization'),
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
		this.emit(context, 'goal.created', goal);
		return context.ok(goal, 201);
	}

	private sample(
		context: MockEverWorksRouteContext,
		goal: Record<string, unknown>,
		input: Record<string, unknown>
	): EverWorksHttpResponse {
		if (goal['goalKind'] === 'delivery')
			return MockEverWorksServer.error(422, 'domain_rule', 'A delivery goal takes no samples.');
		const value = input['value'];
		if (typeof value !== 'number' || typeof input['sampledAt'] !== 'string')
			return MockEverWorksServer.error(400, 'validation_failed', 'value and sampledAt are required.');
		const criterionId = (input['criterionId'] as string | null | undefined) ?? null;
		const criteria = (goal['criteria'] as Array<Record<string, unknown>> | null) ?? [];
		if (criterionId && !criteria.some((c) => c['id'] === criterionId))
			return MockEverWorksServer.error(422, 'domain_rule', 'No such criterion.');
		this.samples.push({
			goalId: goal['id'] as string,
			criterionId,
			value,
			sampledAt: input['sampledAt'] as string
		});
		const changes: Record<string, unknown> = {};
		if (!criterionId) Object.assign(changes, { currentValue: value, currentValueAt: input['sampledAt'] });
		else {
			const score = (goal['resolvedScore'] as { criteria: Array<Record<string, unknown>> } | null) ?? {
				criteria: []
			};
			const rows = criteria.map((c) => {
				const kept = score.criteria.find((row) => row['id'] === c['id']);
				const now = c['id'] === criterionId ? value : ((kept?.['value'] as number | null) ?? null);
				const target = Number(c['target']);
				const ratio = now == null || !target ? 0 : Math.max(0, Math.min(1, now / target));
				return { id: c['id'], value: now, target, weight: Number(c['weight']), ratio, satisfied: ratio >= 1 };
			});
			changes['resolvedScore'] = {
				score: rows.reduce((sum, row) => sum + row.ratio, 0) / (rows.length || 1),
				criteria: rows,
				violatedConstraintIds: [],
				violatedHardConstraintIds: [],
				at: input['sampledAt']
			};
		}
		return this.bump(context, goal, changes, 'goal.progress_changed');
	}

	private bump(
		context: MockEverWorksRouteContext,
		goal: Record<string, unknown>,
		changes: Record<string, unknown>,
		type: string
	): EverWorksHttpResponse {
		Object.assign(goal, changes, { version: Number(goal['version']) + 1, updatedAt: new Date().toISOString() });
		this.emit(context, type, goal);
		return context.ok(goal);
	}

	private emit(context: MockEverWorksRouteContext, type: string, goal: Record<string, unknown>): void {
		const actAs = context.headers['x-act-as-user'];
		void this.mock.emit({
			type,
			organizationId: context.org?.id as string,
			aggregate: { type: 'goal', id: goal['id'] as string, version: Number(goal['version']) },
			actor: actAs ? { type: 'user', id: actAs } : { type: 'integration', id: context.key.keyId },
			origin: { tag: context.headers['x-sync-origin'] ?? null, integrationKeyId: context.key.keyId },
			data: { ...goal }
		});
	}
}
