import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import {
	ID,
	IOrganizationStrategicSignals,
	OrganizationStrategicStateEnum,
	OrganizationStrategicVisibilityScopeEnum
} from '@gauzy/contracts';
import { Goal, OrganizationStrategicInitiative } from '@gauzy/core';
import { EverWorksApiError, EverWorksClient } from '../client/ever-works-client';
import type { EverWorksEventEnvelope, EverWorksListPage } from '../client/ever-works-client.types';
import { EverWorksConnectionService } from '../connection/ever-works-connection.service';
import type { EverWorksDirection } from '../mapping/ever-works-mapping.defaults';
import { EverWorksMappingContext, EverWorksMappingContextService } from '../mapping/ever-works-mapping-context.service';
import { everWorksUserOfGauzyUser } from '../sync/ever-works-actor';
import {
	EverWorksEntityLink,
	EverWorksLinkState,
	EverWorksLinkType,
	EverWorksOutboundChange
} from '../sync/entities/ever-works-sync.entities';
import { EverWorksSyncContext } from '../sync/ever-works-sync.context';
import { EverWorksSyncLogService } from '../sync/ever-works-sync-log.service';
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
export class EverWorksInitiativesService implements EverWorksInboundHandler, EverWorksOutboundHandler, OnModuleInit {
	readonly aggregateTypes = ['mission'] as const;
	readonly entityTypes = [EverWorksLinkType.INITIATIVE_MISSION] as const;
	private readonly logger = new Logger('EverWorksInitiatives');

	constructor(
		private readonly dataSource: DataSource,
		private readonly contexts: EverWorksMappingContextService,
		private readonly connections: EverWorksConnectionService,
		private readonly links: EverWorksLinkService,
		private readonly log: EverWorksSyncLogService,
		private readonly applier: EverWorksInboundApplier,
		private readonly pusher: EverWorksOutboundPusher
	) {}

	/** Registers itself with the applier (`mission.*`) and the pusher (`INITIATIVE_MISSION`). */
	onModuleInit(): void {
		this.applier.register(this);
		this.pusher.register(this);
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
		}
		for (const id of decision.createInEverWorks ?? []) {
			const row = initiatives.get(id);
			if (!row) throw new BadRequestException(`${id} is not an active initiative of this organization.`);
			const eligible = initiativeEligibility(row);
			if (eligible === 'leadership')
				throw new BadRequestException(`${id} is a leadership initiative; leadership initiatives never sync.`);
			if (eligible === 'draft')
				throw new BadRequestException(`${id} is a draft; an initiative goes to Ever Works once it is active.`);
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
			// Pairing changes neither record: from now on each side's changes follow.
			const mission = byEw.get(pair.ewMissionId) as EverWorksMission;
			await this.record(
				context,
				pair.initiativeId,
				mission,
				mission.version ?? null,
				everWorksMissionShared(mission),
				null,
				{},
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
				await this.record(
					context,
					madeFrom,
					mission,
					version,
					everWorksMissionShared(mission),
					null,
					{},
					'inbound'
				);
				return { status: 'applied', message: 'linked to the initiative it was created from' };
			}
			await this.createInitiative(
				context,
				{ ...(data as unknown as EverWorksMission), id: envelope.aggregate.id },
				version
			);
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
		version: number | null
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
		const changes: Record<string, unknown> = {};
		if (next.title && next.title !== before.title) changes['title'] = next.title;
		if (next.description !== (before.description ?? '')) changes['intent'] = next.description;
		if (next.status !== (before.status ?? null))
			Object.assign(changes, this.statusChanges(row, next.status, mission.outcome ?? ew.outcome ?? null));
		if (mission.owner !== undefined && mission.owner?.id !== ew.owner?.id) {
			const steward = await this.stewardOf(context, mission.owner ?? null);
			if (steward) changes['stewardId'] = steward;
		}
		const teams = await this.applyTeams(
			context,
			initiativeId,
			before.teamIds ?? [],
			next.teamIds,
			ew.unmappedTeams ?? []
		);
		if (JSON.stringify(next.teamIds) !== JSON.stringify([...(before.teamIds ?? [])].sort())) {
			// D11: a mission on a team is team-scoped in Gauzy too; on no team, organization-scoped.
			changes['visibilityScope'] = next.teamIds.length
				? OrganizationStrategicVisibilityScopeEnum.TEAM
				: OrganizationStrategicVisibilityScopeEnum.ORGANIZATION;
		}
		if (Object.keys(changes).length)
			await this.dataSource
				.getRepository(OrganizationStrategicInitiative)
				.update({ id: initiativeId } as never, changes as never);
		const works = await this.applyWorks(
			context,
			initiativeId,
			before.works ?? [],
			next.works,
			ew.unmappedWorks ?? []
		);
		const goals = await this.applyGoals(
			context,
			initiativeId,
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
			{ unmappedTeams: teams, unmappedWorks: works, unmappedGoals: goals },
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
		const id = randomUUID() as ID;
		const signals = this.mergedSignals(null, status);
		await this.dataSource.getRepository(OrganizationStrategicInitiative).insert({
			id,
			tenantId: context.tenantId,
			organizationId: context.organizationId,
			title: next.title || 'Mission',
			intent: next.description || null,
			state: status?.state ?? OrganizationStrategicStateEnum.ACTIVE,
			visibilityScope: next.teamIds.length
				? OrganizationStrategicVisibilityScopeEnum.TEAM
				: OrganizationStrategicVisibilityScopeEnum.ORGANIZATION,
			stewardId: await this.stewardOf(context, mission.owner ?? null),
			...(signals ? { signals: this.signalsValue(signals) } : {})
		} as never);
		const teams = await this.applyTeams(context, id, [], next.teamIds, []);
		const works = await this.applyWorks(context, id, [], next.works, []);
		const goals = await this.applyGoals(context, id, [], next.goals, []);
		await this.record(
			context,
			id,
			mission,
			version,
			next,
			null,
			{ unmappedTeams: teams, unmappedWorks: works, unmappedGoals: goals },
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
		outcome: string | null
	): Record<string, unknown> {
		const mapped = missionStatusToInitiative(status, outcome);
		if (!mapped) return {};
		const current = this.signalsOf(row);
		const signals = this.mergedSignals(current, mapped);
		const changed = JSON.stringify(signals ?? null) !== JSON.stringify(current ?? null);
		return { state: mapped.state, ...(changed ? { signals: signals ? this.signalsValue(signals) : null } : {}) };
	}

	private mergedSignals(
		current: IOrganizationStrategicSignals | null,
		mapped: ReturnType<typeof missionStatusToInitiative>
	): IOrganizationStrategicSignals | null {
		if (!mapped) return current;
		const next: IOrganizationStrategicSignals = { ...(current ?? {}) };
		if (mapped.perceivedMomentum) next.perceivedMomentum = mapped.perceivedMomentum;
		// Only the "stalled" the sync set while the mission was paused is cleared on resume.
		else if (mapped.perceivedMomentum === null && next.perceivedMomentum === 'stalled')
			delete next.perceivedMomentum;
		if (mapped.outcome)
			next.strategicNotes =
				`Ever Works mission ${mapped.outcome.replace(/_/g, ' ')}.${next.strategicNotes ? `\n\n${next.strategicNotes}` : ''}`.slice(
					0,
					5000
				);
		return Object.keys(next).length ? next : null;
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
	 * The mission's goals moved: a goal it holds as **primary** gets the initiative (a Gauzy goal has one,
	 * plan 01 §6); one it no longer holds leaves it. Returns the goals Gauzy cannot map.
	 */
	private async applyGoals(
		context: EverWorksMappingContext,
		initiativeId: ID,
		previous: EverWorksMissionGoal[],
		next: EverWorksMissionGoal[],
		retry: string[]
	): Promise<string[]> {
		const goalOf = await this.pairs(context, EverWorksLinkType.GOAL);
		const repository = this.dataSource.getRepository(Goal);
		const primaryBefore = new Set(previous.filter((g) => g.isPrimary).map((g) => g.goalId));
		const primaryNow = new Set(next.filter((g) => g.isPrimary).map((g) => g.goalId));
		const again = new Set(retry);
		const unmapped: string[] = [];
		for (const goalId of primaryNow) {
			const gauzyId = goalOf.get(goalId);
			if (!gauzyId) {
				unmapped.push(goalId);
				continue;
			}
			if (primaryBefore.has(goalId) && !again.has(goalId)) continue;
			await repository.update(
				{ id: gauzyId, tenantId: context.tenantId } as never,
				{ organizationStrategicInitiativeId: initiativeId } as never
			);
		}
		for (const goalId of primaryBefore) {
			if (primaryNow.has(goalId)) continue;
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
				{},
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
					{},
					'outbound'
				);
			} catch (error) {
				if (!(error instanceof EverWorksApiError && error.status === 412) || attempt === 1) throw error;
				const remote = await client.request<EverWorksMission>(
					'GET',
					`/missions/${encodeURIComponent(pair.ewId)}`
				);
				if (fromEverWorks(context.directions.missions)) {
					await EverWorksSyncContext.run(
						{ connectionId: context.connection.id as ID, eventId: `mission-412:${pair.ewId}` },
						() => this.applyMission(context, pair, { ...remote, id: pair.ewId }, remote.version ?? null)
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
		const goals = (await this.dataSource
			.getRepository(Goal)
			.find({
				where: { organizationStrategicInitiativeId: row.id, tenantId: context.tenantId } as never
			})) as Goal[];
		const goalIds = goals.flatMap((goal) =>
			goalOf.has(goal.id as ID) ? [goalOf.get(goal.id as ID) as string] : []
		);
		return {
			now: gauzyInitiativeShared(
				row,
				scope.scope.teamIds,
				workIds,
				goalIds,
				this.links.snapshot<MissionShared>(link)
			)
		};
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
		return this.dataSource
			.getRepository(OrganizationStrategicInitiative)
			.findOne({
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
		unmapped: { unmappedTeams?: string[]; unmappedWorks?: string[]; unmappedGoals?: string[] },
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
			unmappedGoals: unmapped.unmappedGoals ?? previous.unmappedGoals ?? []
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
				const match = linkedInitiativeId
					? undefined
					: initiatives.find((row) => !linked.has(row.id as ID) && sameTitle(row.title, mission.title));
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
