/**
 * What two tag names are compared by: trimmed, in lower case, with dashes and runs of spaces as one space. Ever Teams
 * shows a stored dash as a space and tells a team's labels apart by name, so "Follow-up" and "follow up" are the same
 * label to anyone reading it (ever-co/ever-teams#5016).
 */
export function tagNameKeyOf(name: string | null | undefined): string {
	// Trimmed last: a leading or trailing dash becomes a space, which must not tell two names apart
	return (name ?? '').toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * The labels a new team starts with: a few common ones from Ever Teams' label catalog (ever-co/ever-teams#5016),
 * with the catalog's colours. They are the team's own tags, not system rows: the team renames them, changes their
 * colour or removes them like any other, and adds the rest of the catalog from Ever Teams' Settings › Labels.
 */
export const TEAM_STARTER_TAGS: ReadonlyArray<{ name: string; color: string }> = [
	{ name: 'Bug', color: '#D73A4A' },
	{ name: 'Feature', color: '#8957E5' },
	{ name: 'Enhancement', color: '#1D76DB' },
	{ name: 'Documentation', color: '#0EA5E9' },
	{ name: 'Design', color: '#EC4899' },
	{ name: 'Research', color: '#06B6D4' },
	{ name: 'Needs Review', color: '#3B82F6' },
	{ name: 'Blocked', color: '#DC2626' }
];
