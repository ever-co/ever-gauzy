import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import { GoalLevelEnum, ID, KeyResultTypeEnum, KeyResultUpdateStatusEnum, TimeFrameStatusEnum } from '@gauzy/contracts';
import { Employee, Goal, GoalTimeFrame, IntegrationTenant, KeyResult } from '@gauzy/core';
import { EverWorksApiError, EverWorksClient } from '../client/ever-works-client';
import type { EverWorksEventEnvelope } from '../client/ever-works-client.types';
import type { EverWorksConnection } from '../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EverWorksSettingName } from '../ever-works-setting.enum';
import { EVER_WORKS_LINK_SOURCE } from '../ever-works.constants';
import type { EverWorksDirection } from '../mapping/ever-works-mapping.defaults';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import { everWorksUserOfGauzyUser } from '../sync/ever-works-actor';
import { stableUuid } from '../sync/ever-works-stable-id';
import {
	EverWorksEntityLink,
	EverWorksLinkState,
	EverWorksLinkType,
	EverWorksOutboundChange
} from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { EverWorksSyncLogService } from '../sync/ever-works-sync-log.service';
import { EverWorksSyncLoop, EverWorksSyncSweeper } from '../sync/ever-works-sync.loop';
import { EverWorksOutboundQueue } from '../sync/outbound/ever-works-outbound.queue';
import {
	EverWorksApplyContext,
	EverWorksApplyOutcome,
	EverWorksInboundApplier,
	EverWorksInboundHandler
} from '../sync/inbound/ever-works-inbound.applier';
import { EverWorksLinkService } from '../sync/links/ever-works-link.service';
import {
	EverWorksOutboundHandler,
	EverWorksOutboundPusher,
	EverWorksPushContext,
	EverWorksPushOutcome
} from '../sync/outbound/ever-works-outbound.pusher';
import { isSyncedVisibility } from '../teams/ever-works-team-scope';
import {
	criteriaWritable,
	DesiredKeyResult,
	KeyResultKey,
	KeyResultShared,
	LinkedKeyResultRow,
	mergeGauzyGoal,
	EverWorksGoal,
	everWorksGoalShared,
	GauzyKeyResultRow,
	gauzyGoalToEverWorks,
	goalCreateBody,
	goalPushPlan,
	GoalShared,
	keyResultsOfGoal,
	quarterOf,
	resolveTimeFrame
} from './ever-works-goal.mapper';

/** The goal pair at the last sync: the shared fields (Ever Works' form) plus what only flows EW → G. */
interface GoalSnapshot extends GoalShared {
	progress?: number | null;
	archived?: boolean;
	leadEmployeeId?: ID | null;
	primaryMissionId?: string | null;
	/** The Gauzy time frame (name) at the last sync: while it is unchanged, Ever Works' exact deadline stays. */
	gauzyDeadline?: string | null;
}

/** What only Ever Works has, kept on the goal's link (fields one side lacks are preserved, never nulled). */
interface GoalEverWorksOnly {
	owner?: EverWorksGoal['owner'];
	status?: string | null;
	outcome?: string | null;
	window?: string | null;
	missionIds?: string[];
	primaryMissionId?: string | null;
	loop?: EverWorksGoal['loop'];
	webUrl?: string | null;
	visibility?: string | null;
	/** Ever Works teams beyond the first (a Gauzy goal has one owner team), and the ones Gauzy cannot map. */
	extraTeams?: string[];
	unmappedTeams?: string[];
}

/** How often the goal sweep (key results deleted in Gauzy) runs per connection. */
export const GOAL_SWEEP_MS = 10 * 60_000;

/** The Gauzy-side fields a push may be carrying (kept over Ever Works' older values on a 412). */
type GoalGauzyField = 'title' | 'description' | 'deadline' | 'teams' | 'keyResults';
const GOAL_PATCH_FIELD: Readonly<Record<string, GoalGauzyField>> = {
	title: 'title',
	description: 'description',
	deadline: 'deadline',
	teamIds: 'teams',
	visibility: 'teams'
};

const fromEverWorks = (direction: EverWorksDirection | undefined) =>
	direction === 'both' || direction === 'ew_to_gauzy';
const toEverWorks = (direction: EverWorksDirection | undefined) => direction === 'both' || direction === 'gauzy_to_ew';
const isNumeric = (type: string | null | undefined) =>
	type === KeyResultTypeEnum.NUMERICAL || type === KeyResultTypeEnum.CURRENCY;

/** The fields of a key result an Ever Works goal writes, as compared and kept on its link. */
/** A value as the key result comparison reads it (dates as ISO strings, numbers as numbers). */
function comparable(value: unknown): string {
	if (value instanceof Date) return JSON.stringify(value.toISOString());
	if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
		const date = new Date(value);
		if (!Number.isNaN(date.getTime())) return JSON.stringify(date.toISOString());
	}
	if (
		typeof value === 'string' &&
		value.trim() !== '' &&
		!Number.isNaN(Number(value)) &&
		/^-?\d+(\.\d+)?$/.test(value.trim())
	)
		return JSON.stringify(Number(value));
	return JSON.stringify(value ?? null);
}

/**
 * The Ever Works id of a key result's link: a digest of its goal and its key (`m`, `c:<criterion>`,
 * `d:<item>`), since `<goal id>:<key>` can exceed the 64 characters the link column holds. The goal and
 * the key themselves are kept on the link (`ewOnly`).
 */
export function keyResultEwId(ewGoalId: string, key: KeyResultKey): string {
	return `kr:${createHash('sha256').update(`${ewGoalId}:${key}`).digest('hex').slice(0, 48)}`;
}

/** The goal and key a key result link stands for, or `null` for a link without them. */
export function keyOfLink(
	link: EverWorksEntityLink | null | undefined
): { ewGoalId: string; key: KeyResultKey } | null {
	if (!link?.ewOnly) return null;
	try {
		const value = JSON.parse(link.ewOnly) as { ewGoalId?: unknown; key?: unknown };
		return typeof value.ewGoalId === 'string' && typeof value.key === 'string'
			? { ewGoalId: value.ewGoalId, key: value.key }
			: null;
	} catch {
		return null;
	}
}

const KEY_RESULT_FIELDS: ReadonlyArray<keyof KeyResultShared> = [
	'name',
	'type',
	'targetValue',
	'initialValue',
	'unit',
	'update',
	'progress',
	'weight',
	'deadline',
	'hardDeadline'
];

/**
 * Goals ↔ Goal + KeyResults (plan 01 §6, plan 06 G-P2-1), linked as `GOAL` (and `KEY_RESULT` per key
 * result, Ever Works id `<goal id>:<key>`).
 *
 * - **EW → G** (`goal.*`): title → name, description, deadline → the narrowest active time frame
 *   containing it (else a new quarter `Q<n> <yyyy>`), scope (D11: its first team → `level='Team'` +
 *   `ownerTeamId`, no team → `Organization`, a Gauzy `Employee` goal stays one), lead (the owner, or the
 *   goal's agent), progress, archived, the primary mission's initiative. Criteria, a metric and the
 *   Definition of Done become key results. Only what changed in Ever Works since the last sync is written.
 * - **G → EW**: a Gauzy goal becomes an Ever Works goal (**always `draft`**; numeric key results → a
 *   metric goal on the external source, else a delivery goal from its True/False key results);
 *   fields, criteria and the Definition of Done follow. A key result update is pushed as a **sample**
 *   (`POST /goals/:id/samples`). Gauzy **never** activates, resumes or completes an Ever Works goal
 *   (spend safety, D9): no status is ever sent.
 */
@Injectable()
export class EverWorksGoalsService
	implements EverWorksInboundHandler, EverWorksOutboundHandler, EverWorksSyncSweeper, OnModuleInit
{
	readonly aggregateTypes = ['goal'] as const;
	readonly entityTypes = [EverWorksLinkType.GOAL, EverWorksLinkType.KEY_RESULT] as const;
	readonly sweepIntervalMs = GOAL_SWEEP_MS;
	private readonly logger = new Logger('EverWorksGoals');

	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly connections: EverWorksConnectionService,
		private readonly links: EverWorksLinkService,
		private readonly log: EverWorksSyncLogService,
		private readonly applier: EverWorksInboundApplier,
		private readonly pusher: EverWorksOutboundPusher,
		private readonly loop: EverWorksSyncLoop,
		private readonly queue: EverWorksOutboundQueue
	) {}

	/** Registers itself with the applier (`goal.*`), the pusher (`GOAL`, `KEY_RESULT`) and the sync loop (sweep). */
	onModuleInit(): void {
		this.applier.register(this);
		this.pusher.register(this);
		this.loop.registerSweeper(this);
	}

	// ── Sweep ──────────────────────────────────────────────────────────────────────────────────────

	/**
	 * The goal sweep, run by the sync loop for a connection it holds: a key result deleted in Gauzy by id
	 * (the platform's delete carries no row, so no subscriber sees it) queues its goal's push, which takes
	 * the criterion or Definition-of-Done item out of the Ever Works goal.
	 */
	async sweep(connection: EverWorksConnection): Promise<void> {
		for (const context of await this.contextsOf(connection)) {
			if (!context.isEnabled || !toEverWorks(context.directions.goals)) continue;
			const links = (await this.links.list(context.integrationTenantId, EverWorksLinkType.KEY_RESULT)).filter(
				(link) => link.state === EverWorksLinkState.OK
			);
			if (!links.length) continue;
			const alive = new Set<string>();
			const ids = links.map((link) => link.gauzyId as ID);
			for (let at = 0; at < ids.length; at += 500) {
				const found = (await this.dataSource.getRepository(KeyResult).find({
					where: { id: In(ids.slice(at, at + 500)), tenantId: context.tenantId, isArchived: false } as never,
					select: { id: true } as never
				})) as KeyResult[];
				for (const row of found) alive.add(row.id as string);
			}
			const goals = new Set<string>();
			for (const link of links) {
				const key = keyOfLink(link);
				if (key && !alive.has(link.gauzyId as string)) goals.add(key.ewGoalId);
			}
			for (const ewGoalId of goals) {
				const goalLink = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.GOAL, ewGoalId);
				if (!goalLink || goalLink.state === EverWorksLinkState.UNLINKED) continue;
				await this.queue.enqueue({
					tenantId: context.tenantId,
					organizationId: context.organizationId,
					entityType: EverWorksLinkType.GOAL,
					gauzyId: goalLink.gauzyId as ID,
					op: 'upsert'
				});
			}
		}
	}

	/** The mappings that sync through a connection. */
	private async contextsOf(connection: EverWorksConnection): Promise<EverWorksMappingContext[]> {
		const mappings = await this.dataSource.getRepository(IntegrationTenant).find({
			where: { tenantId: connection.tenantId, isActive: true, isArchived: false } as never,
			relations: { settings: true } as never
		});
		const contexts: EverWorksMappingContext[] = [];
		for (const mapping of mappings) {
			const viaThis = mapping.settings?.some(
				(setting) =>
					setting.settingsName === EverWorksSettingName.CONNECTION_ID &&
					setting.settingsValue === connection.id
			);
			if (!viaThis || !mapping.organizationId) continue;
			const context = await this.contexts.forOrganization(
				connection.tenantId as ID,
				mapping.organizationId as ID
			);
			if (context && context.connection.id === connection.id) contexts.push(context);
		}
		return contexts;
	}

	// ── EW → G ─────────────────────────────────────────────────────────────────────────────────────

	/** Inbound handler: `goal.*`. */
	async apply(envelope: EverWorksEventEnvelope, applyContext: EverWorksApplyContext): Promise<EverWorksApplyOutcome> {
		const context = envelope.organizationId
			? await this.contexts.forEverWorksOrganization(applyContext.connection, envelope.organizationId)
			: null;
		if (!context) return { status: 'skipped', message: 'no mapping for the Ever Works organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (!fromEverWorks(context.directions.goals))
			return { status: 'skipped', message: 'goals are not synced from Ever Works' };
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.GOAL, envelope.aggregate.id);
		if (link?.state === EverWorksLinkState.UNLINKED)
			return { status: 'skipped', message: 'the goal is no longer synced' };
		const version = envelope.aggregate.version ?? null;
		if (link && link.ewVersion != null && version != null && version <= link.ewVersion)
			return { status: 'skipped', message: 'already applied (version)' };
		const goal = { ...((envelope.data ?? {}) as unknown as EverWorksGoal), id: envelope.aggregate.id };
		if (envelope.type === 'goal.deleted') {
			if (!link) return { status: 'skipped', message: 'the goal is not linked' };
			// Delete policy: the Gauzy goal is archived, never deleted.
			await this.dataSource
				.getRepository(Goal)
				.update(
					{ id: link.gauzyId, tenantId: context.tenantId } as never,
					{ isArchived: true, archivedAt: new Date() } as never
				);
			await this.links.unlink(link, 'deleted in Ever Works; the Gauzy goal is archived');
			return { status: 'applied' };
		}
		if (!isSyncedVisibility(goal.visibility)) {
			if (!link) return { status: 'skipped', message: 'the goal is private in Ever Works' };
			await this.links.unlink(link, 'private in Ever Works; no longer shared from Ever Works');
			return { status: 'applied', message: 'the goal turned private; it is no longer synced' };
		}
		if (!envelope.type.startsWith('goal.')) return { status: 'skipped', message: `${envelope.type} is not synced` };
		if (!link && goal.title === undefined) {
			// A first event without the goal's content (an id-only notice): read the goal itself.
			try {
				Object.assign(
					goal,
					await this.client(context).request<EverWorksGoal>('GET', `/goals/${encodeURIComponent(goal.id)}`),
					{ id: goal.id }
				);
			} catch (error) {
				if (error instanceof EverWorksApiError && error.status === 404)
					return { status: 'skipped', message: 'the goal is not visible in Ever Works' };
				throw error;
			}
			if (!isSyncedVisibility(goal.visibility))
				return { status: 'skipped', message: 'the goal is private in Ever Works' };
		}
		return this.applyGoal(context, link, goal, version);
	}

	private async applyGoal(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink | null,
		goal: EverWorksGoal,
		version: number | null,
		keepGauzy: ReadonlySet<GoalGauzyField> = new Set()
	): Promise<EverWorksApplyOutcome> {
		const before = this.links.snapshot<GoalSnapshot>(link);
		const ew = this.ewOnlyOf(link);
		const next = everWorksGoalShared(goal, before);
		const teams = await this.gauzyTeamsOf(context, next.teamIds);
		const leadEmployeeId = await this.leadOf(context, goal, before.leadEmployeeId ?? null);
		const progress = goal.progress !== undefined ? (goal.progress ?? 0) : (before.progress ?? 0);
		const archived = goal.archivedAt !== undefined ? !!goal.archivedAt : (before.archived ?? false);
		const primaryMissionId =
			goal.primaryMissionId !== undefined ? (goal.primaryMissionId ?? null) : (before.primaryMissionId ?? null);
		const repository = this.dataSource.getRepository(Goal);
		let goalId = link?.gauzyId as ID | undefined;
		let madeInGauzy = false;
		let gauzyDeadline: string | null = before.gauzyDeadline ?? null;
		// A team change whose Ever Works team has no Gauzy pair yet waits: the snapshot keeps the old teams,
		// so the change is applied once the team is paired (the next event or the reconcile).
		let teamIds = next.teamIds;
		// While it waits, the Ever Works-only team lists stay as they were too: the push sends the teams of the
		// snapshot, never the old team plus the new one (review F85).
		let teamsWait = false;
		if (!goalId) {
			// A goal made from a Gauzy goal (its own create echoed, or a lost answer) links back to that goal.
			const madeFrom = this.gauzyGoalOf(goal, context.connection.id as ID);
			if (
				madeFrom &&
				(await repository.findOne({
					where: { id: madeFrom, tenantId: context.tenantId, organizationId: context.organizationId } as never
				}))
			) {
				// Its key results are Gauzy's own: they are linked by the goal's next push, never duplicated here.
				goalId = madeFrom;
				madeInGauzy = true;
			} else {
				// Teams first (D11 rule 4): a team-scoped goal whose teams are not paired yet waits.
				if (next.teamIds.length && !teams.first)
					return {
						status: 'deferred',
						message: "waiting for the goal's Ever Works team to be paired (teams first)"
					};
				const deadline =
					(await this.timeFrameOf(context, next.deadline)) ??
					(await this.timeFrameOf(context, new Date().toISOString()));
				gauzyDeadline = deadline ?? quarterOf(new Date()).name;
				// A stable id: a retry after a failure half-way finds the goal it wrote instead of a second one.
				const id = stableUuid(`${context.integrationTenantId}:goal:${goal.id}`) as ID;
				const written = await repository.findOne({ where: { id } as never, withDeleted: true });
				const values = {
					name: next.title || 'Goal',
					description: next.description ?? '',
					deadline: gauzyDeadline,
					level: teams.first ? GoalLevelEnum.TEAM : GoalLevelEnum.ORGANIZATION,
					ownerTeamId: teams.first ?? null,
					leadId: leadEmployeeId,
					progress,
					organizationStrategicInitiativeId: await this.initiativeOf(context, primaryMissionId),
					isArchived: archived,
					archivedAt: archived ? new Date() : null
				};
				if (!written)
					await repository.insert({ id, tenantId: context.tenantId, organizationId: context.organizationId, ...values } as never);
				// A retry finds the goal it wrote: it takes Ever Works' current fields, so the snapshot recorded below is
				// what Gauzy holds and a later push never sends the older ones back (review F87).
				else await repository.update({ id } as never, values as never);
				goalId = id;
				this.logger.log(
					`Ever Works goal ${goal.id} created as Gauzy goal ${goalId} (organization ${context.organizationId}).`
				);
			}
		} else {
			const row = await repository.findOne({
				where: { id: goalId, tenantId: context.tenantId } as never,
				withDeleted: true
			});
			if (!row) return { status: 'skipped', message: 'the Gauzy goal is gone' };
			// `keepGauzy`: fields Gauzy changed after the last sync and is pushing now (a 412 retry) — its edit is
			// the later one, so Ever Works' older value is not written over it; the snapshot still moves to Ever
			// Works' value, so the retry pushes Gauzy's.
			const changes: Record<string, unknown> = {};
			if (next.title && next.title !== before.title && !keepGauzy.has('title')) changes['name'] = next.title;
			if ((next.description ?? null) !== (before.description ?? null) && !keepGauzy.has('description'))
				changes['description'] = next.description ?? '';
			if (next.deadline && next.deadline !== (before.deadline ?? null) && !keepGauzy.has('deadline')) {
				const name = await this.timeFrameOf(context, next.deadline);
				if (name) changes['deadline'] = name;
			}
			gauzyDeadline = (changes['deadline'] as string | undefined) ?? row.deadline ?? gauzyDeadline;
			if (
				JSON.stringify(next.teamIds) !== JSON.stringify([...(before.teamIds ?? [])].sort()) &&
				!keepGauzy.has('teams')
			) {
				if (teams.first) Object.assign(changes, { level: GoalLevelEnum.TEAM, ownerTeamId: teams.first });
				// No team in Ever Works: organization scope — a Gauzy `Employee` goal (also "no team") stays one.
				else if (!next.teamIds.length) {
					if (row.level !== GoalLevelEnum.EMPLOYEE)
						Object.assign(changes, { level: GoalLevelEnum.ORGANIZATION, ownerTeamId: null });
				} else {
					teamIds = [...(before.teamIds ?? [])].sort();
					teamsWait = true;
				}
			}
			if (progress !== (before.progress ?? null)) changes['progress'] = progress;
			if (archived !== (before.archived ?? false))
				Object.assign(changes, { isArchived: archived, archivedAt: archived ? new Date() : null });
			if (leadEmployeeId && leadEmployeeId !== (before.leadEmployeeId ?? null))
				changes['leadId'] = leadEmployeeId;
			if (primaryMissionId !== (before.primaryMissionId ?? null)) {
				const initiativeId = await this.initiativeOf(context, primaryMissionId);
				if (initiativeId) changes['organizationStrategicInitiativeId'] = initiativeId;
				else if (!primaryMissionId) {
					// Ever Works no longer has a primary mission: the goal leaves the initiative of the old one only. An
					// initiative a Gauzy user moved it to stays (its mission lists the goal, not as primary) (review F90).
					const previousInitiativeId = await this.initiativeOf(context, before.primaryMissionId ?? null);
					const current = (row as { organizationStrategicInitiativeId?: ID | null }).organizationStrategicInitiativeId ?? null;
					if (current && current === previousInitiativeId) changes['organizationStrategicInitiativeId'] = null;
				}
			}
			if (Object.keys(changes).length) await repository.update({ id: goalId } as never, changes as never);
		}
		const missing =
			madeInGauzy || keepGauzy.has('keyResults')
				? 0
				: await this.applyKeyResults(
						context,
						goalId,
						goal.id,
						keyResultsOfGoal({ ...goal, ...this.mergedGoal(goal, next) }),
						leadEmployeeId
					);
		await this.record(
			context,
			goalId,
			goal,
			version,
			{ ...next, teamIds, progress, archived, leadEmployeeId, primaryMissionId, gauzyDeadline },
			link,
			teamsWait ? { extraTeams: ew.extraTeams ?? [], unmappedTeams: ew.unmappedTeams ?? [] } : { extraTeams: teams.extra, unmappedTeams: teams.unmapped },
			'inbound'
		);
		return missing
			? { status: 'applied', message: `${missing} key result(s) wait for an owner employee` }
			: { status: 'applied' };
	}

	/** The goal with every shared field filled from the last sync where the event left it out. */
	private mergedGoal(goal: EverWorksGoal, next: GoalShared): Partial<EverWorksGoal> {
		return {
			title: next.title,
			goalKind: next.goalKind,
			targetValue: next.targetValue,
			unit: next.unit,
			baselineValue: next.baselineValue,
			deadline: next.deadline,
			criteria: goal.criteria !== undefined ? goal.criteria : (next.criteria as EverWorksGoal['criteria']),
			dodCriteria:
				goal.dodCriteria !== undefined ? goal.dodCriteria : (next.dodCriteria as EverWorksGoal['dodCriteria'])
		};
	}

	/**
	 * The goal's key results follow Ever Works: a missing one is created (owned by the goal's lead, or the
	 * connecting admin), a changed one gets the fields Ever Works changed since the last sync, and one Ever
	 * Works no longer has is archived and unlinked (nothing is deleted). Returns how many could not be
	 * created for want of an owner employee.
	 */
	private async applyKeyResults(
		context: EverWorksMappingContext,
		goalId: ID,
		ewGoalId: string,
		desired: DesiredKeyResult[],
		leadEmployeeId: ID | null
	): Promise<number> {
		const repository = this.dataSource.getRepository(KeyResult);
		const existing = (await this.links.list(context.integrationTenantId, EverWorksLinkType.KEY_RESULT)).filter(
			(l) => keyOfLink(l)?.ewGoalId === ewGoalId && l.state !== EverWorksLinkState.UNLINKED
		);
		let ownerId: ID | null | undefined;
		let missing = 0;
		for (const result of desired) {
			const { key, ...fields } = result;
			const link = existing.find((l) => keyOfLink(l)?.key === key);
			if (!link) {
				if (ownerId === undefined) ownerId = leadEmployeeId ?? (await this.adminEmployeeOf(context));
				if (!ownerId) {
					missing++;
					continue;
				}
				const id = stableUuid(`${context.integrationTenantId}:key-result:${ewGoalId}:${key}`) as ID;
				const written = await repository.findOne({ where: { id } as never, withDeleted: true });
				if (written) {
					// The key result Ever Works removed (archived and unlinked here) is back with the same id: it is restored
					// with Ever Works' values, never re-linked while archived, or the next push deletes it (review F88).
					if ((written as { deletedAt?: Date | null }).deletedAt) await repository.restore({ id } as never);
					await repository.update(
						{ id } as never,
						{ ...fields, hardDeadline: fields.hardDeadline ? new Date(fields.hardDeadline) : null, isArchived: false, archivedAt: null } as never
					);
				} else
					await repository.insert({
						id,
						tenantId: context.tenantId,
						organizationId: context.organizationId,
						goalId,
						ownerId,
						leadId: leadEmployeeId,
						description: '',
						status: KeyResultUpdateStatusEnum.NONE,
						...fields,
						hardDeadline: fields.hardDeadline ? new Date(fields.hardDeadline) : null
					} as never);
				await this.recordKeyResult(context, id, ewGoalId, key, fields, null);
				continue;
			}
			const before = this.links.snapshot<KeyResultShared>(link);
			const row = (await repository.findOne({ where: { id: link.gauzyId } as never })) as unknown as Record<
				string,
				unknown
			> | null;
			const changes: Record<string, unknown> = {};
			for (const field of KEY_RESULT_FIELDS) {
				const ewMoved = comparable(fields[field]) !== comparable(before[field]);
				// A value a person changed in Gauzy since the last sync is the later edit: it stays, and the next
				// push (or sample) sends it.
				const gauzyMoved = !!row && comparable(row[field]) !== comparable(before[field]);
				if (ewMoved && !gauzyMoved)
					changes[field] =
						field === 'hardDeadline' && fields[field] ? new Date(fields[field] as string) : fields[field];
			}
			if (Object.keys(changes).length) await repository.update({ id: link.gauzyId } as never, changes as never);
			await this.recordKeyResult(context, link.gauzyId as ID, ewGoalId, key, fields, link);
		}
		const kept = new Set(desired.map((result) => result.key));
		for (const link of existing) {
			if (kept.has(keyOfLink(link)?.key as string)) continue;
			await repository.update(
				{ id: link.gauzyId } as never,
				{ isArchived: true, archivedAt: new Date() } as never
			);
			await this.links.unlink(link, 'no longer a key result of the goal in Ever Works; archived in Gauzy');
		}
		return missing;
	}

	// ── G → EW ─────────────────────────────────────────────────────────────────────────────────────

	/** Outbound handler: a Gauzy goal or one of its key results changed (`GOAL`), or a key result's value (`KEY_RESULT`). */
	async push(change: EverWorksOutboundChange, pushContext: EverWorksPushContext): Promise<EverWorksPushOutcome> {
		const context = await this.contexts.forOrganization(change.tenantId as ID, change.organizationId as ID);
		if (!context || context.integrationTenantId !== pushContext.mapping.id)
			return { status: 'skipped', message: 'no mapping for the organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (!toEverWorks(context.directions.goals))
			return { status: 'skipped', message: 'goals are not pushed to Ever Works' };
		return change.entityType === EverWorksLinkType.KEY_RESULT
			? this.pushSample(context, change)
			: this.pushGoal(context, change);
	}

	private async pushGoal(
		context: EverWorksMappingContext,
		change: EverWorksOutboundChange
	): Promise<EverWorksPushOutcome> {
		const link = await this.links.byGauzy(
			context.integrationTenantId,
			EverWorksLinkType.GOAL,
			change.gauzyId as ID
		);
		if (link?.state === EverWorksLinkState.UNLINKED)
			return { status: 'skipped', message: 'the goal is no longer synced' };
		const goal = await this.dataSource.getRepository(Goal).findOne({
			where: {
				id: change.gauzyId,
				tenantId: context.tenantId,
				organizationId: context.organizationId
			} as never,
			withDeleted: true
		});
		if (change.op === 'delete' || !goal || (goal as { deletedAt?: Date | null }).deletedAt) {
			// Delete policy: Ever Works goals are not deleted from Gauzy (and an integration cannot archive one).
			return { status: 'skipped', message: 'Gauzy goal deletes are not pushed to Ever Works (delete policy)' };
		}
		const prepared = await this.prepare(context, goal, link);
		if ('outcome' in prepared) return prepared.outcome;
		const client = this.client(context);
		if (!link)
			return this.create(context, client, goal, prepared.now, prepared.rows, change.actorUserId as ID | null);
		return this.update(context, client, goal, prepared.now, prepared.rows, link);
	}

	/** The Ever Works form of a Gauzy goal (scope, deadline, key results), or the outcome when it cannot go yet. */
	private async prepare(
		context: EverWorksMappingContext,
		goal: Goal,
		link: EverWorksEntityLink | null
	): Promise<{ now: GoalShared; rows: LinkedKeyResultRow[] } | { outcome: EverWorksPushOutcome }> {
		let teamIds: string[] = [];
		if (goal.level === GoalLevelEnum.TEAM && goal.ownerTeamId) {
			const team = await this.links.byGauzy(
				context.integrationTenantId,
				EverWorksLinkType.TEAM,
				goal.ownerTeamId as ID
			);
			if (!team || team.state === EverWorksLinkState.UNLINKED)
				return {
					outcome: {
						status: 'deferred',
						message: `waiting for the Gauzy team ${goal.ownerTeamId} to be paired (teams first)`
					}
				};
			// The other Ever Works teams of a goal synced from Ever Works stay with it.
			teamIds = [team.ewId, ...(this.ewOnlyOf(link).extraTeams ?? [])];
		}
		// Ever Works teams Gauzy cannot map stay too: Gauzy never had them, so it never removes them.
		teamIds.push(...(this.ewOnlyOf(link).unmappedTeams ?? []));
		const rows = await this.keyResultRows(context, goal.id as ID);
		const before = this.links.snapshot<GoalSnapshot>(link);
		// While the Gauzy time frame is the one of the last sync, Ever Works' exact deadline stays (a time frame
		// only knows its end).
		const deadline =
			link && before.deadline !== undefined && goal.deadline === (before.gauzyDeadline ?? undefined)
				? (before.deadline ?? null)
				: await this.deadlineOf(context, goal.deadline);
		const now = link
			? mergeGauzyGoal(goal, deadline, rows, [...new Set(teamIds)], before as GoalShared)
			: gauzyGoalToEverWorks(goal, deadline, rows, [...new Set(teamIds)], null);
		if (!now)
			return {
				outcome: {
					status: 'skipped',
					message:
						'nothing Ever Works can hold yet: the goal is pushed once it has a numeric or True/False key result'
				}
			};
		return { now, rows };
	}

	private async create(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		goal: Goal,
		now: GoalShared,
		rows: GauzyKeyResultRow[],
		actorUserId: ID | null
	): Promise<EverWorksPushOutcome> {
		const connectionId = context.connection.id as ID;
		const body = goalCreateBody(now, {
			source: EVER_WORKS_LINK_SOURCE,
			installationId: connectionId,
			externalId: goal.id
		});
		// Owned in Ever Works by the goal's lead (or owner employee) when paired, else by the author of the change.
		const owner = (goal.leadId ?? goal.ownerEmployeeId) as ID | undefined;
		const person = owner
			? await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.MEMBER, owner)
			: null;
		const actAs =
			person && person.state !== EverWorksLinkState.UNLINKED
				? person.ewId
				: await everWorksUserOfGauzyUser(this.dataSource, this.links, context, actorUserId);
		const key = (actor: string) =>
			createHash('sha256')
				.update(`${connectionId}:${EverWorksLinkType.GOAL}:${goal.id}:create:${actor}:${JSON.stringify(body)}`)
				.digest('hex');
		let created: EverWorksGoal;
		try {
			created = await client.request<EverWorksGoal>('POST', '/goals', {
				body,
				idempotencyKey: key('user'),
				actAsUserId: actAs
			});
		} catch (error) {
			if (!(
				actAs &&
				error instanceof EverWorksApiError &&
				error.status === 403 &&
				error.code === 'act_as_forbidden'
			))
				throw error;
			created = await client.request<EverWorksGoal>('POST', '/goals', {
				body,
				idempotencyKey: key('integration')
			});
		}
		const holder = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.GOAL, created.id);
		if (holder && holder.state !== EverWorksLinkState.UNLINKED && holder.gauzyId !== goal.id)
			return { status: 'skipped', message: `the Ever Works goal ${created.id} is paired with another goal` };
		await this.record(
			context,
			goal.id as ID,
			created,
			created.version ?? null,
			{
				...now,
				progress: goal.progress ?? 0,
				archived: !!goal.isArchived,
				leadEmployeeId: (goal.leadId as ID) ?? null,
				gauzyDeadline: goal.deadline ?? null
			},
			null,
			{},
			'outbound'
		);
		await this.recordKeyResults(context, created.id, now, rows);
		await this.syncSamples(context, client, goal.id as ID, rows);
		this.logger.log(`Gauzy goal ${goal.id} created in Ever Works as a draft goal ${created.id}.`);
		return { status: 'pushed', message: 'created in Ever Works (draft)' };
	}

	private async update(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		goal: Goal,
		now: GoalShared,
		rows: GauzyKeyResultRow[],
		link: EverWorksEntityLink
	): Promise<EverWorksPushOutcome> {
		let pair = link;
		for (let attempt = 0; attempt < 2; attempt++) {
			const before = this.links.snapshot<GoalSnapshot>(pair);
			const plan = goalPushPlan(now, before);
			if (!plan.patch && !plan.criteria && !plan.dod) {
				await this.recordKeyResults(context, pair.ewId, now, rows);
				await this.syncSamples(context, client, goal.id as ID, rows);
				return { status: 'skipped', message: 'nothing changed' };
			}
			const ew = this.ewOnlyOf(pair);
			const actAs = ew.owner?.type === 'user' ? ew.owner.id : null;
			const path = `/goals/${encodeURIComponent(pair.ewId)}`;
			try {
				let version = pair.ewVersion ?? undefined;
				let current: EverWorksGoal | null = null;
				if (plan.patch) {
					current = await client.request<EverWorksGoal>('PATCH', path, {
						body: plan.patch,
						ifMatchVersion: version,
						actAsUserId: actAs
					});
					version = current.version ?? version;
				}
				if (plan.criteria && !criteriaWritable(now.criteria)) {
					// A criterion reads a provider in Ever Works: an integration may write the external source
					// only (422), so the criteria stay as Ever Works has them; the other changes still go.
					this.logger.warn(
						`Goal ${goal.id}: its criteria read a provider in Ever Works; criteria changes are not pushed.`
					);
					now = { ...now, criteria: before.criteria ?? [] };
				}
				if (
					plan.criteria &&
					criteriaWritable(now.criteria) &&
					JSON.stringify(now.criteria) !== JSON.stringify(before.criteria ?? [])
				) {
					current = await client.request<EverWorksGoal>('PUT', `${path}/criteria`, {
						body: { criteria: now.criteria },
						ifMatchVersion: version,
						actAsUserId: actAs
					});
					version = current.version ?? version;
				}
				if (plan.dod) {
					current = await client.request<EverWorksGoal>('PUT', `${path}/dod`, {
						body: { dodCriteria: now.dodCriteria },
						ifMatchVersion: version,
						actAsUserId: actAs
					});
					version = current.version ?? version;
				}
				await this.record(
					context,
					goal.id as ID,
					{ ...(current as EverWorksGoal), id: pair.ewId },
					version ?? null,
					{ ...before, ...now, gauzyDeadline: goal.deadline ?? null },
					pair,
					{},
					'outbound'
				);
				await this.recordKeyResults(context, pair.ewId, now, rows);
				await this.syncSamples(context, client, goal.id as ID, rows);
				return { status: 'pushed' };
			} catch (error) {
				if (!(error instanceof EverWorksApiError && error.status === 412) || attempt === 1) throw error;
				// 412: Ever Works moved on. Its newer state is applied first when goals sync from Ever Works (as
				// the sync, so it is not captured back), then this push is merged again on top of it.
				const remote = await client.request<EverWorksGoal>('GET', path);
				// What Gauzy changed since the last sync is the later edit: Ever Works' value is not written over it.
				const keep = new Set<GoalGauzyField>();
				for (const field of Object.keys(plan.patch ?? {})) keep.add(GOAL_PATCH_FIELD[field] ?? 'keyResults');
				if (plan.criteria || plan.dod) keep.add('keyResults');
				if (fromEverWorks(context.directions.goals)) {
					await EverWorksSyncContext.run(
						{ connectionId: context.connection.id as ID, eventId: `goal-412:${pair.ewId}` },
						() => this.applyGoal(context, pair, { ...remote, id: pair.ewId }, remote.version ?? null, keep)
					);
				} else {
					await this.record(
						context,
						goal.id as ID,
						{ ...remote, id: pair.ewId },
						remote.version ?? null,
						before as GoalSnapshot,
						pair,
						{},
						'outbound'
					);
				}
				const fresh = await this.links.byGauzy(
					context.integrationTenantId,
					EverWorksLinkType.GOAL,
					goal.id as ID
				);
				const freshGoal = await this.dataSource
					.getRepository(Goal)
					.findOne({ where: { id: goal.id, tenantId: context.tenantId } as never });
				if (!fresh || !freshGoal) return { status: 'skipped', message: 'the goal changed during the push' };
				const prepared = await this.prepare(context, freshGoal, fresh);
				if ('outcome' in prepared) return prepared.outcome;
				pair = fresh;
				goal = freshGoal;
				now = prepared.now;
				rows = prepared.rows;
			}
		}
		throw new Error('unreachable');
	}

	/**
	 * A key result's value changed: pushed as an external sample (`POST /goals/:id/samples`) — the goal's
	 * own metric, or the criterion it measures. True/False key results move the Definition of Done
	 * (pushed with the goal). The sample never activates or schedules the goal (Ever Works' rule).
	 */
	private async pushSample(
		context: EverWorksMappingContext,
		change: EverWorksOutboundChange
	): Promise<EverWorksPushOutcome> {
		const keyResult = await this.dataSource.getRepository(KeyResult).findOne({
			where: {
				id: change.gauzyId,
				tenantId: context.tenantId,
				organizationId: context.organizationId
			} as never
		});
		if (!keyResult) return { status: 'skipped', message: 'the key result is gone' };
		if (!isNumeric(keyResult.type))
			return {
				status: 'skipped',
				message: 'only numeric key results are sampled (True/False ones move the Definition of Done)'
			};
		const link = await this.links.byGauzy(
			context.integrationTenantId,
			EverWorksLinkType.KEY_RESULT,
			keyResult.id as ID
		);
		if (!link || link.state === EverWorksLinkState.UNLINKED)
			return {
				status: 'skipped',
				message: 'the key result is not linked yet (the goal push links it and sends its value)'
			};
		const goalLink = await this.links.byGauzy(
			context.integrationTenantId,
			EverWorksLinkType.GOAL,
			keyResult.goalId as ID
		);
		if (!goalLink || goalLink.state === EverWorksLinkState.UNLINKED || keyOfLink(link)?.ewGoalId !== goalLink.ewId)
			return { status: 'skipped', message: 'the goal is not linked' };
		const sent = await this.sendSample(context, this.client(context), goalLink, link, keyResult);
		return sent
			? { status: 'pushed', message: 'sample pushed' }
			: { status: 'skipped', message: 'nothing changed' };
	}

	/**
	 * Sends a numeric key result's value as an external sample when it differs from what Ever Works last
	 * had (its link): the goal's own metric (`m`) or the criterion it measures (`c:<id>`). Returns whether
	 * a sample was sent.
	 */
	private async sendSample(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		goalLink: EverWorksEntityLink,
		link: EverWorksEntityLink,
		keyResult: { id?: string; update?: number | null; updatedAt?: Date }
	): Promise<boolean> {
		const key = keyOfLink(link)?.key ?? '';
		if (key !== 'm' && !key.startsWith('c:')) return false;
		const value = Number(keyResult.update);
		const before = this.links.snapshot<KeyResultShared>(link);
		if (!Number.isFinite(value) || value === before.update) return false;
		const sampledAt = new Date(keyResult.updatedAt ?? Date.now()).toISOString();
		const connectionId = context.connection.id as ID;
		const ew = this.ewOnlyOf(goalLink);
		const goal = await client.request<EverWorksGoal>(
			'POST',
			`/goals/${encodeURIComponent(goalLink.ewId)}/samples`,
			{
				body: { criterionId: key.startsWith('c:') ? key.slice(2) : null, value, sampledAt },
				idempotencyKey: createHash('sha256')
					.update(
						`${connectionId}:${EverWorksLinkType.KEY_RESULT}:${keyResult.id}:sample:${value}:${sampledAt}`
					)
					.digest('hex'),
				actAsUserId: ew.owner?.type === 'user' ? ew.owner.id : null
			}
		);
		await this.recordKeyResult(
			context,
			keyResult.id as ID,
			goalLink.ewId,
			key,
			{ ...(before as KeyResultShared), update: value },
			link
		);
		// The sample moved the goal's version; the goal's own snapshot is unchanged. Recorded only when nothing else
		// moved it in between (the next version): an Ever Works edit made meanwhile would otherwise be skipped as
		// applied. Else the version stays, the edit's event applies it, and the sample's own event is our origin
		// (review F86).
		if (goal?.version != null && goalLink.ewVersion != null && goal.version === goalLink.ewVersion + 1) {
			await this.links.record({
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				integrationTenantId: context.integrationTenantId,
				entityType: EverWorksLinkType.GOAL,
				gauzyId: goalLink.gauzyId as ID,
				ewId: goalLink.ewId,
				ewVersion: goal.version,
				direction: 'outbound'
			});
		}
		return true;
	}

	/** After a goal push: the current value of every numeric key result Ever Works does not have yet, as samples. */
	private async syncSamples(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		goalId: ID,
		rows: GauzyKeyResultRow[]
	): Promise<void> {
		const goalLink = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.GOAL, goalId);
		if (!goalLink) return;
		for (const row of rows.filter((r) => isNumeric(r.type))) {
			const link = await this.links.byGauzy(
				context.integrationTenantId,
				EverWorksLinkType.KEY_RESULT,
				row.id as ID
			);
			if (!link || link.state === EverWorksLinkState.UNLINKED || keyOfLink(link)?.ewGoalId !== goalLink.ewId)
				continue;
			const fresh = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.GOAL, goalId);
			await this.sendSample(context, client, fresh ?? goalLink, link, row);
		}
	}

	/**
	 * Links the Gauzy key results the push sent to their Ever Works keys (`m`, `c:<id>`, `d:<id>`). Each
	 * link keeps what Ever Works makes of what was sent (bucketed weight, deadline, …) with the key result's
	 * current value and progress, so an Ever Works event that changed none of it rewrites nothing (lossy
	 * fields never flap, plan 01 principle 4).
	 */
	private async recordKeyResults(
		context: EverWorksMappingContext,
		ewGoalId: string,
		now: GoalShared,
		rows: LinkedKeyResultRow[]
	): Promise<void> {
		const numbers = rows.filter((row) => isNumeric(row.type));
		const sent = new Map(
			keyResultsOfGoal({
				id: ewGoalId,
				title: now.title,
				goalKind: now.goalKind,
				targetValue: now.targetValue,
				unit: now.unit,
				baselineValue: now.baselineValue,
				deadline: now.deadline,
				criteria: now.criteria,
				dodCriteria: now.dodCriteria
			}).map((result) => [result.key, result])
		);
		for (const row of rows) {
			let key: string | null = null;
			if (isNumeric(row.type) && now.goalKind === 'metric') {
				if (now.criteria.length) {
					const criterion = now.criteria.find(
						(c) => c.id === (row.ewKey?.startsWith('c:') ? row.ewKey.slice(2) : row.id)
					);
					key = criterion ? `c:${criterion.id}` : null;
				} else if (numbers[0]?.id === row.id) key = 'm';
			} else if (row.type === KeyResultTypeEnum.TRUE_OR_FALSE) {
				const item = now.dodCriteria.find(
					(d) => d.id === (row.ewKey?.startsWith('d:') ? row.ewKey.slice(2) : row.id)
				);
				key = item ? `d:${item.id}` : null;
			}
			const made = key ? sent.get(key) : undefined;
			if (!key || !made) continue;
			const ewId = keyResultEwId(ewGoalId, key);
			const existing = await this.links.byGauzy(
				context.integrationTenantId,
				EverWorksLinkType.KEY_RESULT,
				row.id as ID
			);
			const stale = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.KEY_RESULT, ewId);
			if (stale && stale.gauzyId !== row.id) await this.links.remove(stale);
			const { key: _key, ...fields } = made;
			// A True/False key result was just sent with its value (the item's status): that is what Ever Works
			// holds. A numeric one's value goes as a sample (`syncSamples`): what Ever Works holds is the value
			// as last synced, or for a new link the start value.
			const kept =
				existing && existing.ewId === ewId && existing.state !== EverWorksLinkState.UNLINKED
					? this.links.snapshot<KeyResultShared>(existing)
					: null;
			const value = isNumeric(row.type)
				? { update: kept?.update ?? row.initialValue ?? 0, progress: kept?.progress ?? row.progress ?? 0 }
				: { update: row.update ?? 0, progress: row.progress ?? 0 };
			await this.recordKeyResult(context, row.id as ID, ewGoalId, key, { ...fields, ...value }, existing);
		}
		// Key results deleted or archived in Gauzy left the goal with this push: their links stop.
		const present = new Set(rows.map((row) => row.id));
		for (const link of await this.links.list(context.integrationTenantId, EverWorksLinkType.KEY_RESULT)) {
			if (link.state === EverWorksLinkState.UNLINKED || keyOfLink(link)?.ewGoalId !== ewGoalId) continue;
			if (!present.has(link.gauzyId as string))
				await this.links.unlink(link, 'removed in Gauzy; no longer a key result of the goal');
		}
	}

	// ── Gauzy side ─────────────────────────────────────────────────────────────────────────────────

	/** The goal's key results as the push reads them, each with its key on the goal's link when linked. */
	private async keyResultRows(context: EverWorksMappingContext, goalId: ID): Promise<LinkedKeyResultRow[]> {
		const rows = (await this.dataSource.getRepository(KeyResult).find({
			where: { goalId, tenantId: context.tenantId, isArchived: false } as never,
			order: { createdAt: 'ASC' } as never
		})) as KeyResult[];
		const goalLink = await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.GOAL, goalId);
		const result: LinkedKeyResultRow[] = [];
		for (const row of rows) {
			const link = goalLink
				? await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.KEY_RESULT, row.id as ID)
				: null;
			const linked = link && goalLink && link.state !== EverWorksLinkState.UNLINKED ? keyOfLink(link) : null;
			const ewKey = linked && goalLink && linked.ewGoalId === goalLink.ewId ? linked.key : null;
			result.push({
				id: row.id as string,
				name: row.name,
				type: row.type,
				targetValue: row.targetValue ?? null,
				initialValue: row.initialValue ?? null,
				unit: row.unit ?? null,
				update: row.update ?? null,
				progress: row.progress ?? null,
				weight: row.weight ?? null,
				ewKey,
				snapshot: ewKey && link ? this.links.snapshot<KeyResultShared>(link) : null
			});
		}
		return result;
	}

	/**
	 * The Gauzy time frame name of an Ever Works deadline (plan 01 §6): the narrowest active one that
	 * contains it, else a new quarter time frame (created once). `null` for no deadline.
	 */
	private async timeFrameOf(context: EverWorksMappingContext, deadline: string | null): Promise<string | null> {
		if (!deadline) return null;
		const repository = this.dataSource.getRepository(GoalTimeFrame);
		const frames = (await repository.find({
			where: { tenantId: context.tenantId, organizationId: context.organizationId } as never
		})) as GoalTimeFrame[];
		const resolved = resolveTimeFrame(deadline, frames);
		if (!resolved) return null;
		if (resolved.create) {
			await repository.insert({
				id: randomUUID(),
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				name: resolved.create.name,
				status: TimeFrameStatusEnum.ACTIVE,
				startDate: resolved.create.startDate,
				endDate: resolved.create.endDate
			} as never);
		}
		return resolved.name;
	}

	/** G → EW: the deadline of a Gauzy goal — the end of its time frame (by name), or `null`. */
	private async deadlineOf(
		context: EverWorksMappingContext,
		timeFrameName: string | null | undefined
	): Promise<string | null> {
		if (!timeFrameName) return null;
		const frame = await this.dataSource.getRepository(GoalTimeFrame).findOne({
			where: {
				name: timeFrameName,
				tenantId: context.tenantId,
				organizationId: context.organizationId
			} as never
		});
		const end = frame?.endDate ? new Date(frame.endDate) : null;
		return end && !Number.isNaN(end.getTime()) ? end.toISOString() : null;
	}

	/** The Gauzy teams of the goal's Ever Works teams: the first mapped one (its owner team), the others and the unmapped ones. */
	private async gauzyTeamsOf(
		context: EverWorksMappingContext,
		teamIds: string[]
	): Promise<{ first: ID | null; extra: string[]; unmapped: string[] }> {
		const pairs = (await this.links.list(context.integrationTenantId, EverWorksLinkType.TEAM)).filter(
			(link) => link.state !== EverWorksLinkState.UNLINKED
		);
		const byEw = new Map(pairs.map((link) => [link.ewId, link.gauzyId as ID]));
		const mapped = teamIds.filter((id) => byEw.has(id));
		return {
			first: mapped.length ? (byEw.get(mapped[0]) as ID) : null,
			extra: mapped.slice(1),
			unmapped: teamIds.filter((id) => !byEw.has(id))
		};
	}

	/** EW → G lead (plan 01 §6): the goal's agent employee when it has one, else its owner's employee, else as before. */
	private async leadOf(
		context: EverWorksMappingContext,
		goal: EverWorksGoal,
		previous: ID | null
	): Promise<ID | null> {
		for (const agentId of [goal.activeAgentId, goal.assignedAgentId]) {
			if (!agentId) continue;
			const agent = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.AGENT, agentId);
			if (agent && agent.state !== EverWorksLinkState.UNLINKED) return agent.gauzyId as ID;
		}
		if (goal.owner?.type === 'user') {
			const person = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.MEMBER, goal.owner.id);
			if (person && person.state !== EverWorksLinkState.UNLINKED) return person.gauzyId as ID;
		}
		return previous;
	}

	/** The initiative paired with an Ever Works mission (G-P2-2), or `null`. */
	private async initiativeOf(context: EverWorksMappingContext, missionId: string | null): Promise<ID | null> {
		if (!missionId) return null;
		const link = await this.links.byEw(
			context.integrationTenantId,
			EverWorksLinkType.INITIATIVE_MISSION,
			missionId
		);
		return link && link.state !== EverWorksLinkState.UNLINKED ? (link.gauzyId as ID) : null;
	}

	/** The connecting admin's employee in the organization (the owner of key results when the goal has no lead). */
	private async adminEmployeeOf(context: EverWorksMappingContext): Promise<ID | null> {
		const userId = context.connection.connectedByUserId;
		if (!userId) return null;
		const employee = await this.dataSource.getRepository(Employee).findOne({
			where: { userId, tenantId: context.tenantId, organizationId: context.organizationId } as never
		});
		return (employee?.id as ID) ?? null;
	}

	/** The Gauzy goal an Ever Works goal was made from (its `externalLinks` back to Gauzy through this connection), or `null`. */
	private gauzyGoalOf(goal: EverWorksGoal, connectionId: ID): ID | null {
		const link = (goal.externalLinks ?? []).find(
			(l) =>
				l.source === EVER_WORKS_LINK_SOURCE &&
				(!l.installationId || l.installationId === connectionId) &&
				!!l.externalId
		);
		return link ? (link.externalId as ID) : null;
	}

	// ── Shared ─────────────────────────────────────────────────────────────────────────────────────

	private async record(
		context: EverWorksMappingContext,
		goalId: ID,
		goal: EverWorksGoal,
		version: number | null,
		snapshot: GoalSnapshot,
		link: EverWorksEntityLink | null,
		teams: { extraTeams?: string[]; unmappedTeams?: string[] },
		direction: 'inbound' | 'outbound'
	): Promise<void> {
		const previous = this.ewOnlyOf(link);
		const ewOnly: GoalEverWorksOnly = {
			owner: goal.owner ?? previous.owner ?? null,
			status: goal.status ?? previous.status ?? null,
			outcome: goal.outcome !== undefined ? goal.outcome : (previous.outcome ?? null),
			window: goal.window !== undefined ? goal.window : (previous.window ?? null),
			missionIds: goal.missionIds ?? previous.missionIds ?? [],
			primaryMissionId:
				goal.primaryMissionId !== undefined ? goal.primaryMissionId : (previous.primaryMissionId ?? null),
			loop: goal.loop ?? previous.loop ?? null,
			webUrl: goal.webUrl !== undefined ? goal.webUrl : (previous.webUrl ?? null),
			visibility: goal.visibility ?? previous.visibility ?? null,
			extraTeams: teams.extraTeams ?? previous.extraTeams ?? [],
			unmappedTeams: teams.unmappedTeams ?? previous.unmappedTeams ?? []
		};
		await this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.GOAL,
			gauzyId: goalId,
			ewId: goal.id,
			ewVersion: version ?? goal.version ?? null,
			ewUpdatedAt: goal.updatedAt,
			snapshot: snapshot as unknown as Record<string, unknown>,
			ewOnly: ewOnly as unknown as Record<string, unknown>,
			direction
		});
	}

	private async recordKeyResult(
		context: EverWorksMappingContext,
		keyResultId: ID,
		ewGoalId: string,
		key: KeyResultKey,
		fields: KeyResultShared,
		link: EverWorksEntityLink | null
	): Promise<void> {
		await this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.KEY_RESULT,
			gauzyId: keyResultId,
			ewId: keyResultEwId(ewGoalId, key),
			snapshot: fields as unknown as Record<string, unknown>,
			ewOnly: { ewGoalId, key },
			direction: link ? (link.lastDirection === 'outbound' ? 'outbound' : 'inbound') : 'inbound'
		});
	}

	private ewOnlyOf(link: EverWorksEntityLink | null | undefined): GoalEverWorksOnly {
		if (!link?.ewOnly) return {};
		try {
			return JSON.parse(link.ewOnly) as GoalEverWorksOnly;
		} catch {
			return {};
		}
	}

	private client(context: EverWorksMappingContext): EverWorksClient {
		return this.connections.client(context.connection, context.everWorksOrganizationSlug);
	}
}
