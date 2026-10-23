import { ID } from '@gauzy/contracts';

/**
 * Record scope (owner decision D11, plan 01 §2a): a record's teams decide its scope, the same on both
 * sides. A record on a team is `team`-scoped; a record on no team is `organization`-scoped; Ever Works
 * `private` records never sync. Used by every record handler that carries teams (projects, tasks, …).
 */
export type EverWorksRecordVisibility = 'team' | 'organization';

/** The scope of a Gauzy record as it is pushed: its mapped Ever Works teams and the visibility they imply. */
export interface EverWorksTeamScope {
	visibility: EverWorksRecordVisibility;
	teamIds: string[];
}

/**
 * G → EW. Every Gauzy team of the record must be linked first: a record whose team is not linked yet
 * waits (`waitingFor`) instead of going out organization-wide by mistake (rule 4, "teams first").
 */
export function teamScopeFor(
	gauzyTeamIds: ReadonlyArray<ID>,
	everWorksTeamOf: ReadonlyMap<ID, string>
): { scope: EverWorksTeamScope; waitingFor?: undefined } | { scope?: undefined; waitingFor: ID } {
	const teamIds: string[] = [];
	for (const teamId of new Set(gauzyTeamIds)) {
		const ewTeamId = everWorksTeamOf.get(teamId);
		if (!ewTeamId) return { waitingFor: teamId };
		teamIds.push(ewTeamId);
	}
	return { scope: { visibility: teamIds.length ? 'team' : 'organization', teamIds } };
}

/**
 * EW → G. The Gauzy teams of an Ever Works record's `teamIds`; teams not linked (yet) are returned as
 * `unmapped`, for the record's link to keep (fields one side lacks are preserved, never nulled).
 */
export function gauzyTeamsFor(everWorksTeamIds: ReadonlyArray<string> | null | undefined, gauzyTeamOf: ReadonlyMap<string, ID>): { teamIds: ID[]; unmapped: string[] } {
	const teamIds: ID[] = [];
	const unmapped: string[] = [];
	for (const ewTeamId of new Set(everWorksTeamIds ?? [])) {
		const teamId = gauzyTeamOf.get(ewTeamId);
		if (teamId) teamIds.push(teamId);
		else unmapped.push(ewTeamId);
	}
	return { teamIds, unmapped };
}

/** Whether an Ever Works record of this visibility is synced at all (`private` never is; rule 5). */
export function isSyncedVisibility(visibility: string | null | undefined): boolean {
	return visibility !== 'private';
}

/** An Ever Works `avatarIcon` that Gauzy can show as a team emoji (one emoji, nothing else), or `null`. */
export function emojiOf(avatarIcon: string | null | undefined): string | null {
	const value = (avatarIcon ?? '').trim();
	if (!value || value.length > 16) return null;
	return /^(\p{Extended_Pictographic}|\p{Regional_Indicator})(\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|‍|️)*$/u.test(value) ? value : null;
}
