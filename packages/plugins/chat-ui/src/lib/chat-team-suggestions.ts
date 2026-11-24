/** A team of the organization, as the new-channel dialog suggests its name. */
export interface ChatTeam {
	id: string;
	name: string;
}

/** A team name offered for a new channel; `taken` when a channel of that name is already listed. */
export interface ChatTeamSuggestion extends ChatTeam {
	taken: boolean;
}

/** How many team names the new-channel dialog offers at once (typing narrows them). */
export const CHAT_TEAM_SUGGESTIONS = 8;

/** A name as it is compared: trimmed, without a leading `#`, case-insensitive. */
function comparable(name: string): string {
	return name.trim().replace(/^#/, '').trim().toLocaleLowerCase();
}

/**
 * The team names to offer for a new channel while its name is typed: the teams whose name contains what is typed
 * (all of them while nothing is), each name once, those starting with it first, then the ones free before the ones
 * a listed channel already has (`channelNames`, compared without case), then by name.
 */
export function teamSuggestions(
	teams: readonly ChatTeam[],
	typed: string,
	channelNames: readonly (string | null | undefined)[],
	limit = CHAT_TEAM_SUGGESTIONS
): ChatTeamSuggestion[] {
	const query = comparable(typed ?? '');
	const taken = new Set(channelNames.filter((name): name is string => !!name).map(comparable));
	const seen = new Set<string>();
	const found: ChatTeamSuggestion[] = [];
	for (const team of teams) {
		const name = (team?.name ?? '').trim();
		const key = comparable(name);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		if (query && !key.includes(query)) continue;
		found.push({ id: String(team.id), name, taken: taken.has(key) });
	}
	const starts = (suggestion: ChatTeamSuggestion) => Number(!!query && comparable(suggestion.name).startsWith(query));
	return found
		.sort((a, b) => starts(b) - starts(a) || Number(a.taken) - Number(b.taken) || a.name.localeCompare(b.name))
		.slice(0, limit);
}

/** What `teamChannelOf` reads of a conversation. */
export interface ChatChannelLike {
	id?: unknown;
	kind: string;
	name?: string | null;
	archivedAt?: Date | string | null;
	createdAt?: Date | string | null;
	organizationId?: unknown;
}

/** When a channel was created, for the order of `teamChannelOf` (unknown last). */
function createdTime(conversation: ChatChannelLike): number {
	const time = conversation.createdAt ? new Date(conversation.createdAt).getTime() : NaN;
	return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

/**
 * A team's channel among these conversations: the channel named as the team, compared as the new-channel dialog
 * compares a team name with the channels (trimmed, without a leading `#`, case-insensitive), of the given
 * organization only when one is given (my conversations span the tenant: another organization's channel of that name,
 * or a tenant-wide one without an organization, is not this team's). An open one before an archived one, and among them the oldest (then the lowest id): two people
 * who each created one at the same moment both settle on the same. Null when none is named so (or the team has no
 * name).
 */
export function teamChannelOf<T extends ChatChannelLike>(conversations: readonly T[], teamName: string, organizationId: string | null = null): T | null {
	const key = comparable(teamName ?? '');
	if (!key) return null;
	const named = conversations
		.filter((conversation) => conversation?.kind === 'channel' && comparable(conversation.name ?? '') === key)
		.filter((conversation) => !organizationId || (conversation.organizationId != null && String(conversation.organizationId) === organizationId))
		.sort((a, b) => createdTime(a) - createdTime(b) || String(a.id ?? '').localeCompare(String(b.id ?? '')));
	return named.find((conversation) => !conversation.archivedAt) ?? named[0] ?? null;
}
