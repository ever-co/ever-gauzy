import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource, In, IsNull } from 'typeorm';
import {
	ID,
	IOrganizationStrategicSignals,
	OrganizationStrategicStateEnum,
	OrganizationStrategicVisibilityScopeEnum
} from '@gauzy/contracts';
import { Goal, IntegrationTenant, OrganizationStrategicInitiative } from '@gauzy/core';
import { EverWorksApiError, EverWorksClient } from '../client/ever-works-client';
import type { EverWorksEventEnvelope, EverWorksListPage } from '../client/ever-works-client.types';
import type { EverWorksConnection } from '../connection/ever-works-connection.entity';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import { EverWorksSettingName } from '../ever-works-setting.enum';
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
import { gauzyTeamsFor, isSyncedVisibility, teamScopeFor } from '../teams/ever-works-team-scope';
import {
	EverWorksMission,
	EverWorksMissionGoal,
	EverWorksMissionWork,
	everWorksMissionShared,
	gauzyInitiativeOf,
	gauzyInitiativeShared,
	initiativeEligibility,
	initiativeStateToMission,
	missionCreateBody,
	missionPushPlan,
	MissionShared,
	missionStatusToInitiative,
	sameTitle
} from './ever-works-initiative.mapper';

/** How often the initiative sweep (initiatives deleted by id, goals moved between initiatives) runs per connection. */
export const INITIATIVE_SWEEP_MS = 10 * 60_000;

/** Why a TEAM-scoped initiative with no paired team to scope its mission to is not created in Ever Works (review F24). */
export const TEAM_SCOPE_WAITS = 'a team-scoped initiative goes to Ever Works once it is linked to a paired team';

/** Why a mission is not created as a Gauzy initiative yet: none of its teams is paired (review F89). */
export const MISSION_TEAMS_WAIT = "waiting for the mission's Ever Works team to be paired (teams first)";

/** What only Ever Works has, kept on the link (fields one side lacks are preserved, never nulled). */
interface MissionEverWorksOnly {
	owner?: EverWorksMission['owner'];
	type?: string | null;
	outcome?: string | null;
	schedule?: string | null;
	autoBuildWorks?: boolean | null;
	webUrl?: string | null;
	visibility?: string | null;
	/** Ever Works teams, works and goals Gauzy could not map at the last sync; tried again on the next change. */
	unmappedTeams?: string[];
	unmappedWorks?: string[];
	unmappedGoals?: string[];
	/** The sync set the "stalled" momentum (the mission paused): only then does a resume clear it. */
	stalledBySync?: boolean;
	/** Ever Works goals whose Gauzy goal was on this initiative at the last sync (Gauzy showed them here). */
	representedGoals?: string[];
}

/** The link state a write records besides the snapshot. */
interface MissionLinkState {
	unmappedTeams?: string[];
	unmappedWorks?: string[];
	unmappedGoals?: string[];
	stalledBySync?: boolean;
	representedGoals?: string[];
}

/** One Ever Works mission as the Initiatives tab shows it. */
export interface EverWorksMissionRow {
	ewMissionId: string;
	title: string;
	status: string | null;
	linkedInitiativeId: ID | null;
	/** A same-title Gauzy initiative the admin may confirm (never linked silently), or `null`. */
	suggestion: { initiativeId: ID; reason: 'same_title' } | null;
}

export interface EverWorksInitiativesView {
	missions: EverWorksMissionRow[];
	/** Gauzy initiatives of the organization linked to no mission (leadership ones are never offered). */
	unmatchedInitiatives: Array<{ initiativeId: ID; title: string; state: string }>;
}

/** The admin's decisions on the Initiatives tab. */
export interface EverWorksInitiativesDecision {
	links?: Array<{ ewMissionId: string; initiativeId: ID }>;
	unlinks?: string[];
	acceptSuggestions?: boolean;
	/** Ever Works missions to create as Gauzy initiatives. */
	createInGauzy?: string[];
	/** Gauzy initiatives to create in Ever Works (as paused missions). */
	createInEverWorks?: ID[];
}

/** The Gauzy-side fields a push may be carrying (kept over the older Ever Works values on a 412). */
type MissionGauzyField = 'title' | 'description' | 'teams' | 'works' | 'goals' | 'status';
const MISSION_PATCH_FIELD: Readonly<Record<string, MissionGauzyField>> = {
	title: 'title',
	description: 'description',
	teamIds: 'teams',
	visibility: 'teams',
	status: 'status',
	outcome: 'status'
};

const fromEverWorks = (direction: EverWorksDirection | undefined) =>
	direction === 'both' || direction === 'ew_to_gauzy';
const toEverWorks = (direction: EverWorksDirection | undefined) => direction === 'both' || direction === 'gauzy_to_ew';

/**
 * Missions ↔ Strategic Initiatives (owner decision D3b, plan 01 §9, plan 06 G-P2-2), linked as
 * `INITIATIVE_MISSION`.
 *
 * - **First link is reviewed** (plan 01 principle 3): the Initiatives tab pairs missions and
 *   initiatives (same-title suggestions the admin confirms) or creates one on the other side; only
 *   missions / initiatives created after the mapping pair without a review.
 * - **EW → G** (`mission.*`): title, description → intent, status (active → active, paused → active +
 *   momentum stalled, completed / failed → resolved + the outcome in the strategic notes), owner →
 *   steward, teams → the initiative's teams (D11 scope: `visibilityScope` team / organization), works →
 *   projects (through the project ↔ work pairs), the primary goal links → the goals' initiative. Only
 *   what changed in Ever Works since the last sync is written.
 * - **G → EW** (only when the missions direction is `both`): an initiative becomes a mission Ever Works
 *   creates **paused**; title, intent, teams, works and goals follow; retiring or resolving it completes
 *   the mission (outcome cancelled / succeeded). Gauzy never sets a mission active (D9). Drafts wait
 *   until active; **leadership initiatives are never pushed**, and one that turns leadership stops
 *   syncing (its link is flagged).
 * - Type, schedule, auto-build and guardrails stay Ever Works-only (on the link).
 */
@Injectable()
export class EverWorksInitiativesService
	implements EverWorksInboundHandler, EverWorksOutboundHandler, EverWorksSyncSweeper, OnModuleInit
{
	readonly aggregateTypes = ['mission'] as const;
	readonly entityTypes = [EverWorksLinkType.INITIATIVE_MISSION] as const;
	readonly sweepIntervalMs = INITIATIVE_SWEEP_MS;
	private readonly logger = new Logger('EverWorksInitiatives');

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

	/** Registers itself with the applier (`mission.*`), the pusher (`INITIATIVE_MISSION`) and the sync loop (sweep). */
	onModuleInit(): void {
		this.applier.register(this);
		this.pusher.register(this);
		this.loop.registerSweeper(this);
	}

	// ── Sweep ──────────────────────────────────────────────────────────────────────────────────────

	/**
	 * The initiative sweep, run by the sync loop for a connection it holds. It queues the push of:
	 * - a paired initiative deleted in Gauzy by id (the platform's delete carries no row, so no subscriber
	 *   sees it): the push completes its mission as cancelled;
	 * - a paired initiative whose goals changed since the last sync (a goal moved to or off it: the goal's
	 *   save signals the goal, not the initiative it left).
	 */
	async sweep(connection: EverWorksConnection): Promise<void> {
		for (const context of await this.contextsOf(connection)) {
			if (!context.isEnabled || !toEverWorks(context.directions.missions)) continue;
			const links = (
				await this.links.list(context.integrationTenantId, EverWorksLinkType.INITIATIVE_MISSION)
			).filter((link) => link.state === EverWorksLinkState.OK);
			if (!links.length) continue;
			const alive = new Set<string>();
			const ids = links.map((link) => link.gauzyId as ID);
			for (let at = 0; at < ids.length; at += 500) {
				const found = (await this.dataSource.getRepository(OrganizationStrategicInitiative).find({
					where: { id: In(ids.slice(at, at + 500)), tenantId: context.tenantId } as never,
					select: { id: true } as never
				})) as OrganizationStrategicInitiative[];
				for (const row of found) alive.add(row.id as string);
			}
			for (const link of links) {
				const gone = !alive.has(link.gauzyId as string);
				if (!gone) {
					const represented = new Set(this.ewOnlyOf(link).representedGoals ?? []);
					const now = await this.representedGoals(context, link.gauzyId as ID);
					if (now.length === represented.size && now.every((id) => represented.has(id))) continue;
				}
				await this.queue.enqueue({
					tenantId: context.tenantId,
					organizationId: context.organizationId,
					entityType: EverWorksLinkType.INITIATIVE_MISSION,
					gauzyId: link.gauzyId as ID,
					op: gone ? 'delete' : 'upsert'
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

	// ── Initiatives tab ────────────────────────────────────────────────────────────────────────────

	/** `GET /mappings/:id/initiatives`. */
	async initiatives(integrationTenantId: ID, organizationId?: ID): Promise<EverWorksInitiativesView> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		return this.view(context, await this.missions(context));
	}

	/** `PUT /mappings/:id/initiatives`: confirms or removes pairs, accepts suggestions, creates on the other side. */
	async decide(
		integrationTenantId: ID,
		decision: EverWorksInitiativesDecision,
		organizationId?: ID
	): Promise<EverWorksInitiativesView> {
		const context = await this.contexts.forRequest(integrationTenantId, organizationId);
		const creates = !!decision.createInGauzy?.length || !!decision.createInEverWorks?.length;
		if (creates && !context.isEnabled)
			throw new BadRequestException(
				'The mapping is disabled; enable it before creating initiatives or missions.'
			);
		if (decision.createInGauzy?.length && !fromEverWorks(context.directions.missions)) {
			throw new BadRequestException(
				'Missions are not synced from Ever Works for this mapping, so they cannot be created as initiatives.'
			);
		}
		if (decision.createInEverWorks?.length && !toEverWorks(context.directions.missions)) {
			throw new BadRequestException(
				'Initiatives are not pushed to Ever Works for this mapping (missions direction "both"), so they cannot be created as missions.'
			);
		}
		const missions = await this.missions(context);
		const byEw = new Map(missions.map((mission) => [mission.id, mission]));
		const pairs = [...(decision.links ?? [])];
		if (decision.acceptSuggestions) {
			const suggested = (await this.view(context, missions)).missions.flatMap((row) =>
				row.suggestion && !row.linkedInitiativeId
					? [{ ewMissionId: row.ewMissionId, initiativeId: row.suggestion.initiativeId }]
					: []
			);
			const times = new Map<ID, number>();
			for (const s of suggested) times.set(s.initiativeId, (times.get(s.initiativeId) ?? 0) + 1);
			const claimedEw = new Set(pairs.map((p) => p.ewMissionId));
			const claimedGauzy = new Set(pairs.map((p) => p.initiativeId));
			for (const s of suggested) {
				if (times.get(s.initiativeId) !== 1 || claimedEw.has(s.ewMissionId) || claimedGauzy.has(s.initiativeId))
					continue;
				pairs.push(s);
			}
		}
		const initiatives = new Map(
			(
				await this.gauzyInitiatives(context, [
					...pairs.map((p) => p.initiativeId),
					...(decision.createInEverWorks ?? [])
				])
			).map((row) => [row.id as ID, row])
		);
		const seenEw = new Set<string>();
		const seenGauzy = new Set<string>();
		for (const pair of pairs) {
			if (!byEw.has(pair.ewMissionId))
				throw new BadRequestException(
					`${pair.ewMissionId} is not a mission of the mapped Ever Works organization.`
				);
			if (!initiatives.has(pair.initiativeId))
				throw new BadRequestException(`${pair.initiativeId} is not an active initiative of this organization.`);
			if (
				initiativeEligibility(initiatives.get(pair.initiativeId) as OrganizationStrategicInitiative) ===
				'leadership'
			) {
				throw new BadRequestException(
					`${pair.initiativeId} is a leadership initiative; leadership initiatives never sync.`
				);
			}
			if (seenEw.has(pair.ewMissionId) || seenGauzy.has(pair.initiativeId))
				throw new BadRequestException('Each mission and each initiative can be paired once.');
			seenEw.add(pair.ewMissionId);
			seenGauzy.add(pair.initiativeId);
		}
		for (const id of decision.createInGauzy ?? []) {
			if (!byEw.has(id))
				throw new BadRequestException(`${id} is not a mission of the mapped Ever Works organization.`);
			if (await this.teamsWait(context, byEw.get(id) as EverWorksMission))
				throw new BadRequestException(`${id}: ${MISSION_TEAMS_WAIT}.`);
		}
		for (const id of decision.createInEverWorks ?? []) {
			const row = initiatives.get(id);
			if (!row) throw new BadRequestException(`${id} is not an active initiative of this organization.`);
			const eligible = initiativeEligibility(row);
			if (eligible === 'leadership')
				throw new BadRequestException(`${id} is a leadership initiative; leadership initiatives never sync.`);
			if (eligible === 'draft')
				throw new BadRequestException(`${id} is a draft; an initiative goes to Ever Works once it is active.`);
			const prepared = await this.prepare(context, row, null);
			if ('outcome' in prepared && prepared.outcome.message === TEAM_SCOPE_WAITS)
				throw new BadRequestException(`${id}: ${TEAM_SCOPE_WAITS}.`);
		}
		for (const ewMissionId of decision.unlinks ?? []) {
			const link = await this.links.byEw(
				context.integrationTenantId,
				EverWorksLinkType.INITIATIVE_MISSION,
				ewMissionId
			);
			if (link) await this.links.unlink(link, 'unpaired on the Initiatives tab');
		}
		for (const pair of pairs) {
			for (const stale of [
				await this.links.byEw(
					context.integrationTenantId,
					EverWorksLinkType.INITIATIVE_MISSION,
					pair.ewMissionId
				),
				await this.links.byGauzy(
					context.integrationTenantId,
					EverWorksLinkType.INITIATIVE_MISSION,
					pair.initiativeId
				)
			]) {
				if (stale) await this.links.remove(stale);
			}
			// From now on each side's changes follow. What the mission has that Gauzy cannot map is kept on the link,
			// so a Gauzy push never removes it; what it has that Gauzy can map is aligned now (review F25).
			const mission = byEw.get(pair.ewMissionId) as EverWorksMission;
			const shared = everWorksMissionShared(mission);
			if (fromEverWorks(context.directions.missions)) await this.alignOnPairing(context, pair.initiativeId, shared);
			await this.record(
				context,
				pair.initiativeId,
				mission,
				mission.version ?? null,
				shared,
				null,
				await this.linkStateOf(context, pair.initiativeId, shared),
				'inbound'
			);
		}
		await EverWorksSyncContext.run(
			{ connectionId: context.connection.id as ID, eventId: `initiatives-tab:${context.integrationTenantId}` },
			async () => {
				for (const ewMissionId of decision.createInGauzy ?? []) {
					if (
						await this.livePair(
							await this.links.byEw(
								context.integrationTenantId,
								EverWorksLinkType.INITIATIVE_MISSION,
								ewMissionId
							)
						)
					)
						continue;
					const mission = byEw.get(ewMissionId) as EverWorksMission;
					await this.createInitiative(context, mission, mission.version ?? null);
				}
			}
		);
		const client = this.client(context);
		for (const initiativeId of decision.createInEverWorks ?? []) {
			if (
				await this.livePair(
					await this.links.byGauzy(
						context.integrationTenantId,
						EverWorksLinkType.INITIATIVE_MISSION,
						initiativeId
					)
				)
			)
				continue;
			const row = await this.initiative(context, initiativeId);
			if (row) await this.pushInitiative(context, client, row, null, null);
		}
		return this.view(context, await this.missions(context));
	}

	// ── EW → G ─────────────────────────────────────────────────────────────────────────────────────

	/** Inbound handler: `mission.*`. */
	async apply(envelope: EverWorksEventEnvelope, applyContext: EverWorksApplyContext): Promise<EverWorksApplyOutcome> {
		const context = envelope.organizationId
			? await this.contexts.forEverWorksOrganization(applyContext.connection, envelope.organizationId)
			: null;
		if (!context) return { status: 'skipped', message: 'no mapping for the Ever Works organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (!fromEverWorks(context.directions.missions))
			return { status: 'skipped', message: 'missions are not synced from Ever Works' };
		const link = await this.links.byEw(
			context.integrationTenantId,
			EverWorksLinkType.INITIATIVE_MISSION,
			envelope.aggregate.id
		);
		if (link?.state === EverWorksLinkState.UNLINKED)
			return { status: 'skipped', message: 'the mission is no longer synced' };
		const version = envelope.aggregate.version ?? null;
		if (link && link.ewVersion != null && version != null && version <= link.ewVersion)
			return { status: 'skipped', message: 'already applied (version)' };
		const data = (envelope.data ?? {}) as Record<string, unknown>;
		if (envelope.type === 'mission.deleted') {
			if (!link) return { status: 'skipped', message: 'the mission is not linked' };
			// Delete policy: the initiative is retired and archived, never deleted.
			await this.dataSource
				.getRepository(OrganizationStrategicInitiative)
				.update(
					{ id: link.gauzyId, tenantId: context.tenantId } as never,
					{ state: OrganizationStrategicStateEnum.RETIRED, isArchived: true, archivedAt: new Date() } as never
				);
			await this.links.unlink(link, 'deleted in Ever Works; the initiative is retired and archived');
			return { status: 'applied' };
		}
		if (data['visibility'] !== undefined && !isSyncedVisibility(data['visibility'] as string)) {
			if (!link) return { status: 'skipped', message: 'the mission is private in Ever Works' };
			await this.links.unlink(link, 'private in Ever Works; no longer shared from Ever Works');
			return { status: 'applied', message: 'the mission turned private; it is no longer synced' };
		}
		if (!link) {
			// Existing missions are paired on the Initiatives tab; only one created after the mapping arrives unreviewed.
			if (envelope.type !== 'mission.created')
				return { status: 'skipped', message: 'not linked: pair it on the Initiatives tab' };
			const madeFrom = gauzyInitiativeOf(
				{ ...(data as unknown as EverWorksMission), id: envelope.aggregate.id },
				context.connection.id as ID
			);
			if (madeFrom && (await this.initiative(context, madeFrom))) {
				const mission = { ...(data as unknown as EverWorksMission), id: envelope.aggregate.id };
				const shared = everWorksMissionShared(mission);
				await this.record(
					context,
					madeFrom,
					mission,
					version,
					shared,
					null,
					await this.linkStateOf(context, madeFrom, shared),
					'inbound'
				);
				return { status: 'applied', message: 'linked to the initiative it was created from' };
			}
			// A delayed `mission.created` of a mission older than the mapping is not "new": it is reviewed too.
			const createdAt = new Date(String((data as { createdAt?: string }).createdAt ?? envelope.occurredAt));
			const mappedAt = (context.mapping as { createdAt?: Date }).createdAt;
			if (mappedAt && !Number.isNaN(createdAt.getTime()) && createdAt.getTime() < new Date(mappedAt).getTime())
				return {
					status: 'skipped',
					message: 'the mission predates the mapping: pair it on the Initiatives tab'
				};
			const mission = { ...(data as unknown as EverWorksMission), id: envelope.aggregate.id };
			// Teams first (D11 rule 4), as goals do: a team-scoped mission none of whose teams is paired yet would make a
			// TEAM-scoped initiative with no team, which nobody can see (review F89).
			if (await this.teamsWait(context, mission)) return { status: 'deferred', message: MISSION_TEAMS_WAIT };
			await this.createInitiative(context, mission, version);
			return { status: 'applied' };
		}
		const before = this.links.snapshot<MissionShared>(link);
		switch (envelope.type) {
			case 'mission.work.linked':
			case 'mission.work.unlinked': {
				const work = data as unknown as EverWorksMissionWork;
				const works = (before.works ?? []).filter((w) => w.workId !== work.workId);
				if (envelope.type === 'mission.work.linked')
					works.push({ workId: work.workId, relation: work.relation });
				return this.applyMission(context, link, { ...this.missionFrom(link), works }, version);
			}
			case 'mission.goal.linked':
			case 'mission.goal.unlinked': {
				const goal = data as unknown as EverWorksMissionGoal;
				const goals = (before.goals ?? []).filter((g) => g.goalId !== goal.goalId);
				if (envelope.type === 'mission.goal.linked')
					goals.push({ goalId: goal.goalId, isPrimary: !!goal.isPrimary });
				return this.applyMission(context, link, { ...this.missionFrom(link), goals }, version);
			}
			default:
				if (!envelope.type.startsWith('mission.'))
					return { status: 'skipped', message: `${envelope.type} is not synced` };
				return this.applyMission(
					context,
					link,
					{ ...(data as unknown as EverWorksMission), id: envelope.aggregate.id },
					version
				);
		}
	}

	/** Writes what changed in Ever Works since the last sync to the paired initiative, then records the link. */
	private async applyMission(
		context: EverWorksMappingContext,
		link: EverWorksEntityLink,
		mission: EverWorksMission,
		version: number | null,
		keepGauzy: ReadonlySet<MissionGauzyField> = new Set()
	): Promise<EverWorksApplyOutcome> {
		const initiativeId = link.gauzyId as ID;
		const row = await this.initiative(context, initiativeId, true);
		if (!row) return { status: 'skipped', message: 'the Gauzy initiative is gone' };
		if (initiativeEligibility(row) === 'leadership') {
			await this.flagLeadership(context, link);
			return { status: 'skipped', message: 'the initiative is leadership-scoped in Gauzy; it no longer syncs' };
		}
		const before = this.links.snapshot<MissionShared>(link);
		const ew = this.ewOnlyOf(link);
		const next = everWorksMissionShared(mission, before);
		// `keepGauzy`: fields Gauzy changed after the last sync and is pushing now (a 412 retry): its edit is
		// the later one, so the older Ever Works value is not written over it; the snapshot still moves to the
		// Ever Works value, so the retry pushes the Gauzy one.
		const changes: Record<string, unknown> = {};
		if (next.title && next.title !== before.title && !keepGauzy.has('title')) changes['title'] = next.title;
		if (next.description !== (before.description ?? '') && !keepGauzy.has('description'))
			changes['intent'] = next.description;
		let stalledBySync = ew.stalledBySync ?? false;
		if (next.status !== (before.status ?? null) && !keepGauzy.has('status')) {
			const status = this.statusChanges(row, next.status, mission.outcome ?? ew.outcome ?? null, stalledBySync);
			Object.assign(changes, status.changes);
			stalledBySync = status.stalledBySync;
		}
		if (mission.owner !== undefined && mission.owner?.id !== ew.owner?.id) {
			const steward = await this.stewardOf(context, mission.owner ?? null);
			if (steward) changes['stewardId'] = steward;
		}
		const teams = keepGauzy.has('teams')
			? this.unmappedOf(next.teamIds, await this.pairs(context, EverWorksLinkType.TEAM))
			: await this.applyTeams(context, initiativeId, before.teamIds ?? [], next.teamIds, ew.unmappedTeams ?? []);
		if (
			JSON.stringify(next.teamIds) !== JSON.stringify([...(before.teamIds ?? [])].sort()) &&
			!keepGauzy.has('teams')
		) {
			// D11: a mission on a team is team-scoped in Gauzy too; on no team, organization-scoped.
			changes['visibilityScope'] = next.teamIds.length
				? OrganizationStrategicVisibilityScopeEnum.TEAM
				: OrganizationStrategicVisibilityScopeEnum.ORGANIZATION;
		}
		if (Object.keys(changes).length)
			await this.dataSource
				.getRepository(OrganizationStrategicInitiative)
				.update({ id: initiativeId } as never, changes as never);
		const works = keepGauzy.has('works')
			? this.unmappedOf(
					next.works.map((w) => w.workId),
					await this.pairs(context, EverWorksLinkType.PROJECT_WORK)
				)
			: await this.applyWorks(context, initiativeId, before.works ?? [], next.works, ew.unmappedWorks ?? []);
		const goals = keepGauzy.has('goals')
			? this.unmappedOf(
					next.goals.map((g) => g.goalId),
					await this.pairs(context, EverWorksLinkType.GOAL)
				)
			: await this.applyGoals(
					context,
					initiativeId,
					link.ewId,
					before.goals ?? [],
					next.goals,
					ew.unmappedGoals ?? []
				);
		await this.record(
			context,
			initiativeId,
			mission,
			version,
			next,
			link,
			{
				unmappedTeams: teams,
				unmappedWorks: works,
				unmappedGoals: goals,
				stalledBySync,
				representedGoals: await this.representedGoals(context, initiativeId)
			},
			'inbound'
		);
		return { status: 'applied' };
	}

	/** Creates the Gauzy initiative of a mission (created after the mapping, or from the Initiatives tab) and links them. */
	private async createInitiative(
		context: EverWorksMappingContext,
		mission: EverWorksMission,
		version: number | null
	): Promise<ID> {
		const next = everWorksMissionShared(mission);
		const status = missionStatusToInitiative(next.status, mission.outcome ?? null);
		// A stable id: a retry after a failure half-way finds the initiative it wrote instead of a second one.
		const id = stableUuid(`${context.integrationTenantId}:initiative:${mission.id}`) as ID;
		const merged = this.mergedSignals(null, status, false);
		const signals = merged.signals;
		const written = await this.initiative(context, id, true);
		const values = {
			title: next.title || 'Mission',
			intent: next.description || null,
			state: status?.state ?? OrganizationStrategicStateEnum.ACTIVE,
			visibilityScope: next.teamIds.length
				? OrganizationStrategicVisibilityScopeEnum.TEAM
				: OrganizationStrategicVisibilityScopeEnum.ORGANIZATION,
			stewardId: await this.stewardOf(context, mission.owner ?? null),
			...(signals ? { signals: this.signalsValue(signals) } : {})
		};
		if (!written)
			await this.dataSource
				.getRepository(OrganizationStrategicInitiative)
				.insert({ id, tenantId: context.tenantId, organizationId: context.organizationId, ...values } as never);
		// A retry finds the initiative it wrote: it takes Ever Works' current fields, so the snapshot recorded below is
		// what Gauzy holds and a later push never sends the older ones back (review F87).
		else await this.dataSource.getRepository(OrganizationStrategicInitiative).update({ id } as never, values as never);
		const teams = await this.applyTeams(context, id, [], next.teamIds, []);
		const works = await this.applyWorks(context, id, [], next.works, []);
		const goals = await this.applyGoals(context, id, mission.id, [], next.goals, []);
		await this.record(
			context,
			id,
			mission,
			version,
			next,
			null,
			{
				unmappedTeams: teams,
				unmappedWorks: works,
				unmappedGoals: goals,
				stalledBySync: merged.stalledBySync,
				representedGoals: await this.representedGoals(context, id)
			},
			'inbound'
		);
		this.logger.log(
			`Ever Works mission ${mission.id} created as Gauzy initiative ${id} (organization ${context.organizationId}).`
		);
		return id;
	}

	/** The state and signals of a mission status (plan 01 §9), keeping the initiative's other signals. */
	private statusChanges(
		row: OrganizationStrategicInitiative,
		status: string | null,
		outcome: string | null,
		stalledBySync: boolean
	): { changes: Record<string, unknown>; stalledBySync: boolean } {
		const mapped = missionStatusToInitiative(status, outcome);
		if (!mapped) return { changes: {}, stalledBySync };
		const current = this.signalsOf(row);
		const merged = this.mergedSignals(current, mapped, stalledBySync);
		const changed = JSON.stringify(merged.signals ?? null) !== JSON.stringify(current ?? null);
		return {
			changes: {
				state: mapped.state,
				...(changed ? { signals: merged.signals ? this.signalsValue(merged.signals) : null } : {})
			},
			stalledBySync: merged.stalledBySync
		};
	}

	private mergedSignals(
		current: IOrganizationStrategicSignals | null,
		mapped: ReturnType<typeof missionStatusToInitiative>,
		stalledBySync: boolean
	): { signals: IOrganizationStrategicSignals | null; stalledBySync: boolean } {
		if (!mapped) return { signals: current, stalledBySync };
		const next: IOrganizationStrategicSignals = { ...(current ?? {}) };
		let owned = stalledBySync;
		if (mapped.perceivedMomentum) {
			// Paused: "stalled", owned by the sync only when the sync is the one setting it.
			if (next.perceivedMomentum !== mapped.perceivedMomentum) owned = true;
			next.perceivedMomentum = mapped.perceivedMomentum;
		} else if (mapped.perceivedMomentum === null) {
			// Resumed: only the "stalled" the sync set is cleared; a person's assessment stays.
			if (owned && next.perceivedMomentum === 'stalled') delete next.perceivedMomentum;
			owned = false;
		}
		if (mapped.outcome)
			next.strategicNotes =
				`Ever Works mission ${mapped.outcome.replace(/_/g, ' ')}.${next.strategicNotes ? `\n\n${next.strategicNotes}` : ''}`.slice(
					0,
					5000
				);
		return { signals: Object.keys(next).length ? next : null, stalledBySync: owned };
	}

	/**
	 * Pairing on the Initiatives tab (review F25): the link's snapshot is the mission, so what the initiative lacks
	 * would read as a Gauzy change on its first save and be pushed — stripping the mission's teams (widening it to the
	 * organization) and its works. So the mission's paired works are added to the initiative's projects (a later push
	 * then only adds the initiative's own works to the mission), and an initiative with no team of its own takes the
	 * mission's paired teams and is team-scoped (D11). Only additions, never a removal, on the Gauzy side.
	 */
	private async alignOnPairing(context: EverWorksMappingContext, initiativeId: ID, shared: MissionShared): Promise<void> {
		await EverWorksSyncContext.run(
			{ connectionId: context.connection.id as ID, eventId: `initiatives-tab:pair:${initiativeId}` },
			async () => {
				await this.applyWorks(context, initiativeId, [], shared.works, []);
				const own = (await this.dataSource
					.createQueryBuilder()
					.relation(OrganizationStrategicInitiative, 'teams')
					.of(initiativeId)
					.loadMany()) as Array<{ id: ID }>;
				if (own.length) return;
				const teamOf = await this.pairs(context, EverWorksLinkType.TEAM);
				if (!shared.teamIds.some((teamId) => teamOf.has(teamId))) return;
				// Team-scoped first, then the teams: a failure in between leaves it narrower (team-scoped, no team yet),
				// never wider, and pairing again finishes it (it still has no team of its own).
				await this.dataSource
					.getRepository(OrganizationStrategicInitiative)
					.update({ id: initiativeId } as never, { visibilityScope: OrganizationStrategicVisibilityScopeEnum.TEAM } as never);
				await this.applyTeams(context, initiativeId, [], shared.teamIds, []);
			}
		);
	}

	/** The mission's teams moved: the same adds and removes on the initiative's teams. Returns the teams Gauzy cannot map. */
	private async applyTeams(
		context: EverWorksMappingContext,
		initiativeId: ID,
		previous: string[],
		next: string[],
		retry: string[]
	): Promise<string[]> {
		const teamOf = await this.pairs(context, EverWorksLinkType.TEAM);
		return this.applySet(initiativeId, 'teams', previous, next, retry, teamOf);
	}

	/** The mission's works moved: the same adds and removes on the initiative's projects (through the project ↔ work pairs). */
	private async applyWorks(
		context: EverWorksMappingContext,
		initiativeId: ID,
		previous: EverWorksMissionWork[],
		next: EverWorksMissionWork[],
		retry: string[]
	): Promise<string[]> {
		const projectOf = await this.pairs(context, EverWorksLinkType.PROJECT_WORK);
		return this.applySet(
			initiativeId,
			'projects',
			previous.map((w) => w.workId),
			next.map((w) => w.workId),
			retry,
			projectOf
		);
	}

	/**
	 * The mission's goals moved. A Gauzy goal has one initiative and an Ever Works goal can sit in several
	 * missions (plan 01 §6: the primary mission wins): a goal of this mission gets the initiative when this
	 * is its primary mission (`primaryMissionId` on its goal link), or when it has none and no initiative
	 * yet; a goal that left the mission leaves the initiative it had here. Returns the goals Gauzy cannot map.
	 */
	private async applyGoals(
		context: EverWorksMappingContext,
		initiativeId: ID,
		missionId: string,
		previous: EverWorksMissionGoal[],
		next: EverWorksMissionGoal[],
		retry: string[]
	): Promise<string[]> {
		const goalOf = await this.pairs(context, EverWorksLinkType.GOAL);
		const repository = this.dataSource.getRepository(Goal);
		const before = new Set(previous.map((g) => g.goalId));
		const now = new Set(next.map((g) => g.goalId));
		const again = new Set(retry);
		const unmapped: string[] = [];
		for (const goalId of now) {
			const gauzyId = goalOf.get(goalId);
			if (!gauzyId) {
				unmapped.push(goalId);
				continue;
			}
			if (before.has(goalId) && !again.has(goalId)) continue;
			const primaryMissionId = await this.primaryMissionOf(context, goalId);
			if (primaryMissionId === missionId) {
				await repository.update(
					{ id: gauzyId, tenantId: context.tenantId } as never,
					{ organizationStrategicInitiativeId: initiativeId } as never
				);
			} else if (!primaryMissionId) {
				// No primary mission: this one, unless the goal is on another initiative already.
				await repository.update(
					{ id: gauzyId, tenantId: context.tenantId, organizationStrategicInitiativeId: IsNull() } as never,
					{ organizationStrategicInitiativeId: initiativeId } as never
				);
			}
		}
		for (const goalId of before) {
			if (now.has(goalId)) continue;
			const gauzyId = goalOf.get(goalId);
			if (gauzyId)
				await repository.update(
					{
						id: gauzyId,
						tenantId: context.tenantId,
						organizationStrategicInitiativeId: initiativeId
					} as never,
					{ organizationStrategicInitiativeId: null } as never
				);
		}
		return unmapped;
	}

	/** The Ever Works goals whose Gauzy goal is on the initiative now (what Gauzy shows on it). */
	private async representedGoals(context: EverWorksMappingContext, initiativeId: ID): Promise<string[]> {
		const goalOf = new Map(
			[...(await this.pairs(context, EverWorksLinkType.GOAL)).entries()].map(([ewId, gauzyId]) => [gauzyId, ewId])
		);
		const goals = (await this.dataSource
			.getRepository(Goal)
			.find({
				where: { organizationStrategicInitiativeId: initiativeId, tenantId: context.tenantId } as never
			})) as Goal[];
		return goals.flatMap((goal) => (goalOf.has(goal.id as ID) ? [goalOf.get(goal.id as ID) as string] : []));
	}

	/** The link state of a new pair: what the mission has that Gauzy cannot map, and the goals Gauzy shows here. */
	private async linkStateOf(
		context: EverWorksMappingContext,
		initiativeId: ID,
		shared: MissionShared
	): Promise<MissionLinkState> {
		return {
			unmappedTeams: this.unmappedOf(shared.teamIds, await this.pairs(context, EverWorksLinkType.TEAM)),
			unmappedWorks: this.unmappedOf(
				shared.works.map((w) => w.workId),
				await this.pairs(context, EverWorksLinkType.PROJECT_WORK)
			),
			unmappedGoals: this.unmappedOf(
				shared.goals.map((g) => g.goalId),
				await this.pairs(context, EverWorksLinkType.GOAL)
			),
			representedGoals: await this.representedGoals(context, initiativeId)
		};
	}

	/** The primary mission an Ever Works goal names (kept on its goal link by the goal sync), or `null`. */
	private async primaryMissionOf(context: EverWorksMappingContext, ewGoalId: string): Promise<string | null> {
		const link = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.GOAL, ewGoalId);
		if (!link?.ewOnly) return null;
		try {
			return (JSON.parse(link.ewOnly) as { primaryMissionId?: string | null }).primaryMissionId ?? null;
		} catch {
			return null;
		}
	}

	/** The Ever Works ids among `ids` that have no Gauzy pair. */
	private unmappedOf(ids: ReadonlyArray<string>, pairs: Map<string, ID>): string[] {
		return ids.filter((id) => !pairs.has(id));
	}

	/** Adds and removes on one M:N relation of the initiative; returns the Ever Works ids of `next` Gauzy cannot map. */
	private async applySet(
		initiativeId: ID,
		relationName: 'teams' | 'projects',
		previous: string[],
		next: string[],
		retry: string[],
		gauzyOf: Map<string, ID>
	): Promise<string[]> {
		const again = new Set(retry);
		const added = gauzyTeamsFor(
			next.filter((id) => !previous.includes(id) || again.has(id)),
			gauzyOf
		);
		const removed = gauzyTeamsFor(
			previous.filter((id) => !next.includes(id)),
			gauzyOf
		).teamIds;
		const unmapped = gauzyTeamsFor(next, gauzyOf).unmapped;
		if (!added.teamIds.length && !removed.length) return unmapped;
		const relation = this.dataSource
			.createQueryBuilder()
			.relation(OrganizationStrategicInitiative, relationName)
			.of(initiativeId);
		const current = new Set(((await relation.loadMany()) as Array<{ id: ID }>).map((row) => row.id));
		const toAdd = added.teamIds.filter((id) => !current.has(id));
		const toRemove = removed.filter((id) => current.has(id));
		if (toAdd.length || toRemove.length) await relation.addAndRemove(toAdd, toRemove);
		return unmapped;
	}

	// ── G → EW ─────────────────────────────────────────────────────────────────────────────────────

	/** Outbound handler: a Gauzy initiative changed. */
	async push(change: EverWorksOutboundChange, pushContext: EverWorksPushContext): Promise<EverWorksPushOutcome> {
		const context = await this.contexts.forOrganization(change.tenantId as ID, change.organizationId as ID);
		if (!context || context.integrationTenantId !== pushContext.mapping.id)
			return { status: 'skipped', message: 'no mapping for the organization' };
		if (!context.isEnabled) return { status: 'skipped', message: 'the mapping is disabled' };
		if (!toEverWorks(context.directions.missions))
			return {
				status: 'skipped',
				message: 'initiatives are not pushed to Ever Works (missions direction "both")'
			};
		const link = await this.links.byGauzy(
			context.integrationTenantId,
			EverWorksLinkType.INITIATIVE_MISSION,
			change.gauzyId as ID
		);
		if (link?.state === EverWorksLinkState.UNLINKED)
			return { status: 'skipped', message: 'the initiative is no longer synced' };
		const row = await this.initiative(context, change.gauzyId as ID, true);
		const client = this.client(context);
		if (change.op === 'delete' || !row || (row as { deletedAt?: Date | null }).deletedAt) {
			// Delete policy (archive / cancel): the paired mission is completed as cancelled; nothing is deleted.
			if (!link) return { status: 'skipped', message: 'not linked' };
			const before = this.links.snapshot<MissionShared>(link);
			if (before.status === 'completed' || before.status === 'failed')
				return { status: 'skipped', message: 'the mission is finished already' };
			await this.write(context, client, link, 'PATCH', '', { status: 'completed', outcome: 'cancelled' });
			await this.links.unlink(link, 'the initiative was removed in Gauzy; its mission is completed as cancelled');
			return { status: 'pushed', message: 'the initiative was removed; the mission is completed as cancelled' };
		}
		if (!link && !this.createdAfterMapping(row, context))
			return { status: 'skipped', message: 'not linked yet: pair it on the Initiatives tab' };
		return this.pushInitiative(context, client, row, link, change.actorUserId as ID | null);
	}

	/** Creates or updates the mission of an initiative. */
	private async pushInitiative(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		row: OrganizationStrategicInitiative,
		link: EverWorksEntityLink | null,
		actorUserId: ID | null
	): Promise<EverWorksPushOutcome> {
		const eligible = initiativeEligibility(row);
		if (eligible === 'leadership') {
			if (link) await this.flagLeadership(context, link);
			return { status: 'skipped', message: 'leadership initiatives are never pushed to Ever Works' };
		}
		if (!link && eligible === 'draft')
			return { status: 'skipped', message: 'a draft initiative goes to Ever Works once it is active' };
		const prepared = await this.prepare(context, row, link);
		if ('outcome' in prepared) return prepared.outcome;
		const { now } = prepared;
		const finish = initiativeStateToMission(row.state);
		if (!link) {
			const connectionId = context.connection.id as ID;
			const body = missionCreateBody(now, connectionId, row.id as ID);
			const steward = row.stewardId
				? await this.links.byGauzy(context.integrationTenantId, EverWorksLinkType.MEMBER, row.stewardId as ID)
				: null;
			const actAs =
				steward && steward.state !== EverWorksLinkState.UNLINKED
					? steward.ewId
					: await everWorksUserOfGauzyUser(this.dataSource, this.links, context, actorUserId);
			const key = (actor: string) =>
				createHash('sha256')
					.update(
						`${connectionId}:${EverWorksLinkType.INITIATIVE_MISSION}:${row.id}:create:${actor}:${JSON.stringify(body)}`
					)
					.digest('hex');
			let created: EverWorksMission;
			try {
				created = await client.request<EverWorksMission>('POST', '/missions', {
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
				created = await client.request<EverWorksMission>('POST', '/missions', {
					body,
					idempotencyKey: key('integration')
				});
			}
			const holder = await this.links.byEw(
				context.integrationTenantId,
				EverWorksLinkType.INITIATIVE_MISSION,
				created.id
			);
			if (holder && holder.state !== EverWorksLinkState.UNLINKED && holder.gauzyId !== row.id)
				return { status: 'skipped', message: `the mission ${created.id} is paired with another initiative` };
			const createdShared = everWorksMissionShared(created);
			const pair = await this.record(
				context,
				row.id as ID,
				created,
				created.version ?? null,
				{ ...createdShared, title: now.title, description: now.description, teamIds: now.teamIds },
				null,
				{ representedGoals: await this.representedGoals(context, row.id as ID) },
				'outbound'
			);
			this.logger.log(`Gauzy initiative ${row.id} created in Ever Works as a paused mission ${created.id}.`);
			// The works, goals and a finished state follow as updates (the create takes none of them).
			await this.update(context, client, row, now, finish, pair);
			return { status: 'pushed', message: 'created in Ever Works (paused)' };
		}
		const before = this.links.snapshot<MissionShared>(link);
		const plan = missionPushPlan(now, before, finish);
		if (!plan.patch && !plan.works && !plan.goals) return { status: 'skipped', message: 'nothing changed' };
		await this.update(context, client, row, now, finish, link);
		return { status: 'pushed' };
	}

	/** Sends what differs from the last sync (PATCH, then the works and goals sets), with one 412 retry on Ever Works' newer state. */
	private async update(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		row: OrganizationStrategicInitiative,
		now: MissionShared,
		finish: ReturnType<typeof initiativeStateToMission>,
		link: EverWorksEntityLink
	): Promise<EverWorksEntityLink> {
		let pair = link;
		for (let attempt = 0; attempt < 2; attempt++) {
			const before = this.links.snapshot<MissionShared>(pair);
			const plan = missionPushPlan(now, before, finish);
			if (!plan.patch && !plan.works && !plan.goals) return pair;
			try {
				let current: EverWorksMission | null = null;
				let version = pair.ewVersion ?? undefined;
				if (plan.patch) {
					current = await this.write(context, client, pair, 'PATCH', '', plan.patch, version);
					version = current.version ?? version;
				}
				if (plan.works) {
					current = await this.write(context, client, pair, 'PUT', '/works', { works: now.works }, version);
					version = current.version ?? version;
				}
				if (plan.goals) {
					current = await this.write(context, client, pair, 'PUT', '/goals', { goals: now.goals }, version);
					version = current.version ?? version;
				}
				const status =
					current?.status ?? (plan.patch?.['status'] as string | undefined) ?? before.status ?? null;
				return this.record(
					context,
					row.id as ID,
					{ ...(current as EverWorksMission), id: pair.ewId },
					version ?? null,
					{ ...now, status },
					pair,
					{ representedGoals: await this.representedGoals(context, row.id as ID) },
					'outbound'
				);
			} catch (error) {
				if (!(error instanceof EverWorksApiError && error.status === 412) || attempt === 1) throw error;
				const remote = await client.request<EverWorksMission>(
					'GET',
					`/missions/${encodeURIComponent(pair.ewId)}`
				);
				// What Gauzy changed since the last sync is the later edit: the Ever Works value is not written over it.
				const keep = new Set<MissionGauzyField>();
				for (const field of Object.keys(plan.patch ?? {})) keep.add(MISSION_PATCH_FIELD[field] ?? 'status');
				if (plan.works) keep.add('works');
				if (plan.goals) keep.add('goals');
				if (fromEverWorks(context.directions.missions)) {
					await EverWorksSyncContext.run(
						{ connectionId: context.connection.id as ID, eventId: `mission-412:${pair.ewId}` },
						() =>
							this.applyMission(context, pair, { ...remote, id: pair.ewId }, remote.version ?? null, keep)
					);
				}
				const fresh = await this.links.byGauzy(
					context.integrationTenantId,
					EverWorksLinkType.INITIATIVE_MISSION,
					row.id as ID
				);
				const freshRow = await this.initiative(context, row.id as ID);
				if (!fresh || !freshRow) return pair;
				if (!fromEverWorks(context.directions.missions)) {
					// One way: only Ever Works' newer version is recorded, so the retry merges on top of it.
					pair = await this.record(
						context,
						row.id as ID,
						{ ...remote, id: pair.ewId },
						remote.version ?? null,
						before as MissionShared,
						fresh,
						{},
						'outbound'
					);
				} else pair = fresh;
				const prepared = await this.prepare(context, freshRow, pair);
				if ('outcome' in prepared) return pair;
				row = freshRow;
				now = prepared.now;
				finish = initiativeStateToMission(freshRow.state);
			}
		}
		return pair;
	}

	/** The Ever Works side of a Gauzy initiative (scope, works, goals), or why it cannot go yet. */
	private async prepare(
		context: EverWorksMappingContext,
		row: OrganizationStrategicInitiative,
		link: EverWorksEntityLink | null
	): Promise<{ now: MissionShared } | { outcome: EverWorksPushOutcome }> {
		const relation = (name: 'teams' | 'projects') =>
			this.dataSource
				.createQueryBuilder()
				.relation(OrganizationStrategicInitiative, name)
				.of(row.id as ID)
				.loadMany() as Promise<Array<{ id: ID }>>;
		const teamIds = (await relation('teams')).map((team) => team.id);
		const scope = teamScopeFor(
			teamIds,
			new Map(
				[...(await this.pairs(context, EverWorksLinkType.TEAM)).entries()].map(([ewId, gauzyId]) => [
					gauzyId,
					ewId
				])
			)
		);
		if (!scope.scope)
			return {
				outcome: {
					status: 'deferred',
					message: `waiting for the Gauzy team ${scope.waitingFor} to be paired (teams first)`
				}
			};
		const workOf = new Map(
			[...(await this.pairs(context, EverWorksLinkType.PROJECT_WORK)).entries()].map(([ewId, gauzyId]) => [
				gauzyId,
				ewId
			])
		);
		const workIds = (await relation('projects')).flatMap((project) =>
			workOf.has(project.id) ? [workOf.get(project.id) as string] : []
		);
		const goalOf = new Map(
			[...(await this.pairs(context, EverWorksLinkType.GOAL)).entries()].map(([ewId, gauzyId]) => [gauzyId, ewId])
		);
		const goals = (await this.dataSource.getRepository(Goal).find({
			where: { organizationStrategicInitiativeId: row.id, tenantId: context.tenantId } as never
		})) as Goal[];
		const goalIds = goals.flatMap((goal) =>
			goalOf.has(goal.id as ID) ? [goalOf.get(goal.id as ID) as string] : []
		);
		// What the mission has that Gauzy cannot show stays with it: teams, works and goals without a Gauzy
		// pair, and goals whose Gauzy goal sits on another initiative (a Gauzy goal has one; the mission
		// shares it with another mission).
		const before = this.links.snapshot<MissionShared>(link);
		const ew = this.ewOnlyOf(link);
		const keepGoals: string[] = [];
		const gauzyGoalOf = await this.pairs(context, EverWorksLinkType.GOAL);
		const here = new Set(goals.map((g) => g.id as ID));
		for (const goal of before.goals ?? []) {
			const gauzyId = gauzyGoalOf.get(goal.goalId);
			if (gauzyId && here.has(gauzyId)) continue;
			// A goal Gauzy showed on this initiative at the last sync and no longer does was moved off it by a
			// person: it leaves the mission. Any other (Gauzy never showed it here) the mission keeps.
			if (!gauzyId || !(ew.representedGoals ?? []).includes(goal.goalId)) keepGoals.push(goal.goalId);
		}
		const now = gauzyInitiativeShared(row, scope.scope.teamIds, workIds, goalIds, before, {
			teamIds: ew.unmappedTeams ?? [],
			workIds: ew.unmappedWorks ?? [],
			goalIds: keepGoals
		});
		// D11 (review F24): a TEAM-scoped initiative is never sent organization-visible. With no team to scope the
		// mission to (it reaches its teams through its aligned projects only, or its direct teams were cleared), a new
		// one waits for a paired team, and a paired mission keeps the teams it has (its other fields still follow).
		if (row.visibilityScope === OrganizationStrategicVisibilityScopeEnum.TEAM && !now.teamIds.length) {
			if (!link) return { outcome: { status: 'skipped', message: TEAM_SCOPE_WAITS } };
			now.teamIds = [...(before.teamIds ?? [])].sort();
		}
		return { now };
	}

	/** One write to the paired mission, as its owner (Ever Works answers someone else's mission with 404). */
	private write(
		context: EverWorksMappingContext,
		client: EverWorksClient,
		link: EverWorksEntityLink,
		method: 'PATCH' | 'PUT',
		suffix: string,
		body: Record<string, unknown>,
		version?: number
	): Promise<EverWorksMission> {
		const ew = this.ewOnlyOf(link);
		return client.request<EverWorksMission>(method, `/missions/${encodeURIComponent(link.ewId)}${suffix}`, {
			body,
			...(version !== undefined ? { ifMatchVersion: version } : {}),
			actAsUserId: ew.owner?.type === 'user' ? ew.owner.id : null
		});
	}

	/** An initiative that turned leadership-scoped stops syncing; its link is flagged (plan 01 §9). */
	private async flagLeadership(context: EverWorksMappingContext, link: EverWorksEntityLink): Promise<void> {
		await this.links.unlink(
			link,
			'the initiative is leadership-scoped in Gauzy; leadership initiatives never sync'
		);
		await this.log.write({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			connectionId: context.connection.id as ID,
			direction: 'outbound',
			entityType: EverWorksLinkType.INITIATIVE_MISSION,
			gauzyId: link.gauzyId as ID,
			ewId: link.ewId,
			action: 'unlinked_leadership',
			status: 'skipped',
			message:
				'The initiative became leadership-scoped, so it no longer syncs with its Ever Works mission (both are kept).'
		});
	}

	// ── Shared ─────────────────────────────────────────────────────────────────────────────────────

	private async initiative(
		context: EverWorksMappingContext,
		id: ID,
		withDeleted = false
	): Promise<OrganizationStrategicInitiative | null> {
		return this.dataSource.getRepository(OrganizationStrategicInitiative).findOne({
			where: { id, tenantId: context.tenantId, organizationId: context.organizationId } as never,
			withDeleted
		});
	}

	private async gauzyInitiatives(
		context: EverWorksMappingContext,
		only?: ID[]
	): Promise<OrganizationStrategicInitiative[]> {
		if (only && !only.length) return [];
		return this.dataSource.getRepository(OrganizationStrategicInitiative).find({
			where: {
				tenantId: context.tenantId,
				organizationId: context.organizationId,
				isArchived: false,
				...(only ? { id: In(only) } : {})
			} as never
		});
	}

	/** Live pairs of a link type, Ever Works id → Gauzy id. */
	/** Whether a team-scoped mission has none of its Ever Works teams paired with a Gauzy team yet (review F89). */
	private async teamsWait(context: EverWorksMappingContext, mission: EverWorksMission): Promise<boolean> {
		const teamIds = everWorksMissionShared(mission).teamIds;
		if (!teamIds.length) return false;
		const teamOf = await this.pairs(context, EverWorksLinkType.TEAM);
		return !teamIds.some((teamId) => teamOf.has(teamId));
	}

	private async pairs(context: EverWorksMappingContext, type: EverWorksLinkType): Promise<Map<string, ID>> {
		const rows = (await this.links.list(context.integrationTenantId, type)).filter(
			(link) => link.state !== EverWorksLinkState.UNLINKED
		);
		return new Map(rows.map((link) => [link.ewId, link.gauzyId as ID]));
	}

	private async stewardOf(context: EverWorksMappingContext, owner: EverWorksMission['owner']): Promise<ID | null> {
		if (owner?.type !== 'user') return null;
		const person = await this.links.byEw(context.integrationTenantId, EverWorksLinkType.MEMBER, owner.id);
		return person && person.state !== EverWorksLinkState.UNLINKED ? (person.gauzyId as ID) : null;
	}

	private signalsOf(row: OrganizationStrategicInitiative): IOrganizationStrategicSignals | null {
		const value = row.signals;
		if (!value) return null;
		if (typeof value === 'object') return value;
		try {
			return JSON.parse(value) as IOrganizationStrategicSignals;
		} catch {
			return null;
		}
	}

	/** The `signals` column value: an object on Postgres / MySQL (json), a JSON string on SQLite (text). */
	private signalsValue(signals: IOrganizationStrategicSignals): IOrganizationStrategicSignals | string {
		const type = String(this.dataSource.options?.type ?? '');
		return type === 'sqlite' || type === 'better-sqlite3' ? JSON.stringify(signals) : signals;
	}

	private async livePair(link: EverWorksEntityLink | null): Promise<boolean> {
		if (!link) return false;
		if (link.state !== EverWorksLinkState.UNLINKED) return true;
		await this.links.remove(link);
		return false;
	}

	private createdAfterMapping(row: OrganizationStrategicInitiative, context: EverWorksMappingContext): boolean {
		const created = (row as { createdAt?: Date }).createdAt;
		const mapped = (context.mapping as { createdAt?: Date }).createdAt;
		return !!created && !!mapped && new Date(created).getTime() >= new Date(mapped).getTime();
	}

	private async record(
		context: EverWorksMappingContext,
		initiativeId: ID,
		mission: EverWorksMission,
		version: number | null,
		snapshot: MissionShared,
		link: EverWorksEntityLink | null,
		unmapped: MissionLinkState,
		direction: 'inbound' | 'outbound'
	): Promise<EverWorksEntityLink> {
		const previous = this.ewOnlyOf(link);
		const ewOnly: MissionEverWorksOnly = {
			owner: mission.owner ?? previous.owner ?? null,
			type: mission.type ?? previous.type ?? null,
			outcome: mission.outcome !== undefined ? mission.outcome : (previous.outcome ?? null),
			schedule: mission.schedule !== undefined ? mission.schedule : (previous.schedule ?? null),
			autoBuildWorks: mission.autoBuildWorks ?? previous.autoBuildWorks ?? null,
			webUrl: mission.webUrl !== undefined ? mission.webUrl : (previous.webUrl ?? null),
			visibility: mission.visibility ?? previous.visibility ?? null,
			unmappedTeams: unmapped.unmappedTeams ?? previous.unmappedTeams ?? [],
			unmappedWorks: unmapped.unmappedWorks ?? previous.unmappedWorks ?? [],
			unmappedGoals: unmapped.unmappedGoals ?? previous.unmappedGoals ?? [],
			stalledBySync: unmapped.stalledBySync ?? previous.stalledBySync ?? false,
			representedGoals: unmapped.representedGoals ?? previous.representedGoals ?? []
		};
		return this.links.record({
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			integrationTenantId: context.integrationTenantId,
			entityType: EverWorksLinkType.INITIATIVE_MISSION,
			gauzyId: initiativeId,
			ewId: mission.id,
			ewVersion: version ?? mission.version ?? null,
			ewUpdatedAt: mission.updatedAt,
			snapshot: snapshot as unknown as Record<string, unknown>,
			ewOnly: ewOnly as unknown as Record<string, unknown>,
			direction
		});
	}

	private ewOnlyOf(link: EverWorksEntityLink | null | undefined): MissionEverWorksOnly {
		if (!link?.ewOnly) return {};
		try {
			return JSON.parse(link.ewOnly) as MissionEverWorksOnly;
		} catch {
			return {};
		}
	}

	/** The Ever Works side of a paired mission, as last synced (every shared field falls back to the snapshot). */
	private missionFrom(link: EverWorksEntityLink): EverWorksMission {
		return { id: link.ewId };
	}

	private client(context: EverWorksMappingContext): EverWorksClient {
		return this.connections.client(context.connection, context.everWorksOrganizationSlug);
	}

	private async missions(context: EverWorksMappingContext): Promise<EverWorksMission[]> {
		const client = this.client(context);
		const missions: EverWorksMission[] = [];
		let cursor: string | null = null;
		for (let page = 0; page < 100; page++) {
			const result: EverWorksListPage<EverWorksMission> = await client.request('GET', '/missions', {
				query: { limit: 500, cursor }
			});
			missions.push(...(result.data ?? []));
			if (!result.hasMore || !result.nextCursor) break;
			cursor = result.nextCursor;
		}
		return missions.filter((mission) => !mission.deleted && isSyncedVisibility(mission.visibility));
	}

	private async view(
		context: EverWorksMappingContext,
		missions: EverWorksMission[]
	): Promise<EverWorksInitiativesView> {
		const links = (await this.links.list(context.integrationTenantId, EverWorksLinkType.INITIATIVE_MISSION)).filter(
			(link) => link.state !== EverWorksLinkState.UNLINKED
		);
		const linkByEw = new Map(links.map((link) => [link.ewId, link.gauzyId as ID]));
		const linked = new Set(links.map((link) => link.gauzyId as ID));
		// Leadership initiatives are never offered (they never sync).
		const initiatives = (await this.gauzyInitiatives(context)).filter(
			(row) => initiativeEligibility(row) !== 'leadership'
		);
		return {
			missions: missions.map((mission) => {
				const linkedInitiativeId = linkByEw.get(mission.id) ?? null;
				// A suggestion only when exactly one free initiative has the title: with two of the same title,
				// which one is meant is the admin's call (and "accept every suggestion" must not pick one).
				const candidates = linkedInitiativeId
					? []
					: initiatives.filter((row) => !linked.has(row.id as ID) && sameTitle(row.title, mission.title));
				const match = candidates.length === 1 ? candidates[0] : undefined;
				return {
					ewMissionId: mission.id,
					title: mission.title ?? '',
					status: mission.status ?? null,
					linkedInitiativeId,
					suggestion: match ? { initiativeId: match.id as ID, reason: 'same_title' as const } : null
				};
			}),
			unmatchedInitiatives: initiatives
				.filter((row) => !linked.has(row.id as ID))
				.map((row) => ({ initiativeId: row.id as ID, title: row.title, state: row.state }))
		};
	}
}
