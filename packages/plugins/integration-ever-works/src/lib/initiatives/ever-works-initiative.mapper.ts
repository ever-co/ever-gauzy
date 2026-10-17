import {
	ID,
	OrganizationStrategicPerceivedMomentumEnum,
	OrganizationStrategicStateEnum,
	OrganizationStrategicVisibilityScopeEnum
} from '@gauzy/contracts';
import { EVER_WORKS_LINK_SOURCE } from '../ever-works.constants';

/**
 * Missions ↔ Strategic Initiatives (owner decision D3b, plan 01 §9, plan 06 G-P2-2). Pure functions.
 */

/** A work of a mission and how the mission relates to it (`mission_works`). */
export interface EverWorksMissionWork {
	workId: string;
	relation?: 'created' | 'improves' | 'operates' | 'markets' | 'researches' | 'retires' | string;
}

/** A goal of a mission (`mission_goals`); at most one is primary. */
export interface EverWorksMissionGoal {
	goalId: string;
	isPrimary?: boolean;
}

/** An Ever Works mission (contract v1 mission DTO, EW-P2-5, ever-works #2652 / CR-8; also the `data` of `mission.*` events). */
export interface EverWorksMission {
	id: string;
	organizationId?: string;
	version?: number;
	updatedAt?: string;
	visibility?: string;
	owner?: { type: 'user' | 'agent' | 'integration'; id: string } | null;
	externalLinks?: Array<{
		source: string;
		installationId?: string | null;
		externalId: string;
		externalUrl?: string | null;
	}>;
	teamIds?: string[];
	title?: string;
	description?: string | null;
	type?: string;
	status?: 'active' | 'paused' | 'completed' | 'failed';
	outcome?: string | null;
	schedule?: string | null;
	autoBuildWorks?: boolean;
	works?: EverWorksMissionWork[];
	goals?: EverWorksMissionGoal[];
	webUrl?: string | null;
	deleted?: boolean;
}

/** Ever Works' limits on a mission (`missions.title varchar(200)`). */
export const EVER_WORKS_MISSION_TITLE_MAX = 200;
/** The relation a work a Gauzy project brings to a mission gets (Ever Works keeps its own for the others). */
export const DEFAULT_MISSION_WORK_RELATION = 'improves';

/** The Gauzy side of a mission's status (plan 01 §9). */
export interface InitiativeStatusFields {
	state: OrganizationStrategicStateEnum;
	/** `stalled` while paused; `null` clears a stalled momentum the sync set; `undefined` leaves it. */
	perceivedMomentum?: OrganizationStrategicPerceivedMomentumEnum | null;
	/** The outcome of a finished mission, kept in the strategic notes. */
	outcome?: string | null;
}

/**
 * EW → G (plan 01 §9): active → active; paused → active + perceived momentum `stalled`; completed or
 * failed → resolved (+ the outcome in the strategic notes). Unknown → `null` (unchanged).
 */
export function missionStatusToInitiative(
	status: string | null | undefined,
	outcome?: string | null
): InitiativeStatusFields | null {
	switch (status) {
		case 'active':
			return { state: OrganizationStrategicStateEnum.ACTIVE, perceivedMomentum: null };
		case 'paused':
			return {
				state: OrganizationStrategicStateEnum.ACTIVE,
				perceivedMomentum: OrganizationStrategicPerceivedMomentumEnum.STALLED
			};
		case 'completed':
			return { state: OrganizationStrategicStateEnum.RESOLVED, outcome: outcome ?? 'completed' };
		case 'failed':
			return { state: OrganizationStrategicStateEnum.RESOLVED, outcome: outcome ?? 'failed' };
		default:
			return null;
	}
}

/**
 * G → EW (plan 01 §9): only finishing is pushed — retired → completed with outcome `cancelled`,
 * resolved → completed with outcome `succeeded`. Gauzy never sets a mission `active` (spend safety, D9),
 * and draft / active leave Ever Works' status as it is.
 */
export function initiativeStateToMission(
	state: string | null | undefined
): { status: 'completed'; outcome: 'cancelled' | 'succeeded' } | null {
	if (state === OrganizationStrategicStateEnum.RETIRED) return { status: 'completed', outcome: 'cancelled' };
	if (state === OrganizationStrategicStateEnum.RESOLVED) return { status: 'completed', outcome: 'succeeded' };
	return null;
}

/**
 * Whether a Gauzy initiative may go to Ever Works: `leadership` initiatives never (Ever Works has no
 * equivalent the integration may set, 01 §2a / §9); a draft not before it is active.
 */
export function initiativeEligibility(initiative: {
	state?: string | null;
	visibilityScope?: string | null;
}): 'ok' | 'leadership' | 'draft' {
	if (initiative.visibilityScope === OrganizationStrategicVisibilityScopeEnum.LEADERSHIP) return 'leadership';
	if (!initiative.state || initiative.state === OrganizationStrategicStateEnum.DRAFT) return 'draft';
	return 'ok';
}

/** The shared fields of a mission pair, in Ever Works' form (the link snapshot both directions compare). */
export interface MissionShared {
	title: string;
	description: string;
	teamIds: string[];
	works: EverWorksMissionWork[];
	goals: EverWorksMissionGoal[];
	/** Ever Works' status as last synced (Gauzy only ever finishes it). */
	status: string | null;
}

const byWork = (a: EverWorksMissionWork, b: EverWorksMissionWork) => a.workId.localeCompare(b.workId);
const byGoal = (a: EverWorksMissionGoal, b: EverWorksMissionGoal) => a.goalId.localeCompare(b.goalId);

/** EW → G: the shared fields of a mission, falling back to the last sync for what an event leaves out. */
export function everWorksMissionShared(mission: EverWorksMission, before: Partial<MissionShared> = {}): MissionShared {
	return {
		title: mission.title !== undefined ? mission.title.trim() : (before.title ?? ''),
		description: mission.description !== undefined ? (mission.description ?? '') : (before.description ?? ''),
		teamIds: [...(mission.teamIds ?? before.teamIds ?? [])].sort(),
		works: [...(mission.works ?? before.works ?? [])]
			.map((w) => ({ workId: w.workId, relation: w.relation ?? DEFAULT_MISSION_WORK_RELATION }))
			.sort(byWork),
		goals: [...(mission.goals ?? before.goals ?? [])]
			.map((g) => ({ goalId: g.goalId, isPrimary: !!g.isPrimary }))
			.sort(byGoal),
		status: mission.status ?? before.status ?? null
	};
}

/**
 * G → EW: the Ever Works side of a Gauzy initiative — title (cut to 200), intent as the description (Ever
 * Works requires one: the title when it is empty), its mapped teams, the works of its linked projects
 * (keeping the relation Ever Works has for each, else `improves`) and its goals (the primary one stays
 * Ever Works' choice), plus what Ever Works has that Gauzy cannot show (`keep`).
 */
export function gauzyInitiativeShared(
	initiative: { title?: string | null; intent?: string | null },
	teamIds: ReadonlyArray<string>,
	workIds: ReadonlyArray<string>,
	goalIds: ReadonlyArray<string>,
	before: Partial<MissionShared> = {},
	keep: { teamIds?: ReadonlyArray<string>; workIds?: ReadonlyArray<string>; goalIds?: ReadonlyArray<string> } = {}
): MissionShared {
	const title = String(initiative.title ?? '')
		.trim()
		.slice(0, EVER_WORKS_MISSION_TITLE_MAX);
	const relationOf = new Map(
		(before.works ?? []).map((w) => [w.workId, w.relation ?? DEFAULT_MISSION_WORK_RELATION])
	);
	// The mission's primary goal stays the one Ever Works has (at most one per mission); Gauzy never picks one.
	const primary = (before.goals ?? []).find((g) => g.isPrimary)?.goalId ?? null;
	return {
		title,
		description: String(initiative.intent ?? '').trim() || title,
		// What Ever Works has that Gauzy cannot show (`keep`) stays: Gauzy never had it, so it never removes it.
		teamIds: [...new Set([...teamIds, ...(keep.teamIds ?? [])])].sort(),
		works: [...new Set([...workIds, ...(keep.workIds ?? [])])]
			.map((workId) => ({ workId, relation: relationOf.get(workId) ?? DEFAULT_MISSION_WORK_RELATION }))
			.sort(byWork),
		goals: [...new Set([...goalIds, ...(keep.goalIds ?? [])])]
			.map((goalId) => ({ goalId, isPrimary: goalId === primary }))
			.sort(byGoal),
		status: before.status ?? null
	};
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** The writes a Gauzy initiative needs in Ever Works against the last sync: a `PATCH` body, and the sets to `PUT`. */
export function missionPushPlan(
	now: MissionShared,
	before: Partial<MissionShared>,
	finish: ReturnType<typeof initiativeStateToMission>
): { patch: Record<string, unknown> | null; works: boolean; goals: boolean } {
	const patch: Record<string, unknown> = {};
	if (now.title && now.title !== before.title) patch['title'] = now.title;
	if (now.description && now.description !== before.description) patch['description'] = now.description;
	if (!same(now.teamIds, [...(before.teamIds ?? [])].sort())) {
		patch['teamIds'] = now.teamIds;
		patch['visibility'] = now.teamIds.length ? 'team' : 'organization';
	}
	// Finishing is pushed once, while Ever Works has the mission unfinished.
	if (finish && before.status !== 'completed' && before.status !== 'failed') Object.assign(patch, finish);
	return {
		patch: Object.keys(patch).length ? patch : null,
		works: !same(now.works, [...(before.works ?? [])].sort(byWork)),
		goals: !same(now.goals, [...(before.goals ?? [])].sort(byGoal))
	};
}

/** `POST /missions` body (`CreateMission`, ever-works #2652): Ever Works always creates it `paused`, one-shot, with no schedule or auto-build (D9). */
export function missionCreateBody(now: MissionShared, connectionId: ID, initiativeId: ID): Record<string, unknown> {
	return {
		title: now.title,
		description: now.description,
		teamIds: now.teamIds,
		visibility: now.teamIds.length ? 'team' : 'organization',
		externalRef: { source: EVER_WORKS_LINK_SOURCE, installationId: connectionId, externalId: initiativeId }
	};
}

/** The Gauzy initiative an Ever Works mission was made from (its `externalLinks` through this connection), or `null`. */
export function gauzyInitiativeOf(mission: EverWorksMission, connectionId: ID): ID | null {
	const link = (mission.externalLinks ?? []).find(
		(l) =>
			l.source === EVER_WORKS_LINK_SOURCE &&
			(!l.installationId || l.installationId === connectionId) &&
			!!l.externalId
	);
	return link ? (link.externalId as ID) : null;
}

/** A same-title match the admin may confirm on the Initiatives tab (never linked silently). */
export function sameTitle(a: string | null | undefined, b: string | null | undefined): boolean {
	return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}
