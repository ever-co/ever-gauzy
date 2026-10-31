import { IGithubIssue, IOrganizationProject, normalizeGithubLabelName } from '@gauzy/contracts';

/**
 * How a project mapped to a GitHub repository syncs the issues GitHub sends as they are opened or changed
 * (the webhook automation; the "Auto sync" and "Manual sync" buttons import issues regardless).
 */
export enum GithubProjectSyncModeEnum {
	/** The project does not auto-sync issues. */
	OFF = 'OFF',
	/** Every issue becomes a task of the project. */
	ALL_ISSUES = 'ALL_ISSUES',
	/** Only the issues that carry the project's sync label do. */
	LABELLED = 'LABELLED'
}

/**
 * The sync mode of a project, read the way the API's automation reads the project settings.
 *
 * @param project - The project and its auto-sync settings.
 */
export function getGithubProjectSyncMode(
	project: Pick<IOrganizationProject, 'isTasksAutoSync' | 'isTasksAutoSyncOnLabel'> | null | undefined
): GithubProjectSyncModeEnum {
	if (!project?.isTasksAutoSync) {
		return GithubProjectSyncModeEnum.OFF;
	}
	return project.isTasksAutoSyncOnLabel ? GithubProjectSyncModeEnum.LABELLED : GithubProjectSyncModeEnum.ALL_ISSUES;
}

/**
 * Each name once, compared regardless of case like GitHub compares label names (a repository cannot hold both `Bug`
 * and `bug`); the first spelling wins. Empty names are dropped.
 */
function uniqueLabelNames(names: ReadonlyArray<string>): string[] {
	const seen = new Set<string>();
	return names.filter((name) => {
		const key = name.toLowerCase();
		if (!name || seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

/**
 * The label names to offer for a project's sync label: the preferred ones first, in the given order (the default
 * label, the project's own), then every other label the issues carry, alphabetically. Each name appears once,
 * compared regardless of case. A preferred name the repository spells differently (`Gauzy` against the repository's
 * `gauzy`) is offered in the repository's spelling: the sync matches label names exactly, so that is the one to pick.
 *
 * @param issues - Issues of the repository; their labels are the suggestions.
 * @param preferred - Names to list first; empty ones are skipped.
 */
export function collectGithubLabelNames(
	issues: ReadonlyArray<Pick<IGithubIssue, 'labels'>> | null | undefined,
	preferred: ReadonlyArray<string | null | undefined> = []
): string[] {
	const repositoryLabels = uniqueLabelNames(
		(issues ?? [])
			.flatMap((issue) => issue?.labels ?? [])
			.map((label) => normalizeGithubLabelName(label?.name))
			.sort((a, b) => a.localeCompare(b))
	);
	const repositorySpelling = new Map(repositoryLabels.map((name) => [name.toLowerCase(), name]));
	const preferredLabels = preferred
		.map(normalizeGithubLabelName)
		.map((name) => repositorySpelling.get(name.toLowerCase()) ?? name);

	return uniqueLabelNames([...preferredLabels, ...repositoryLabels]);
}

/**
 * The label names that contain what the user typed, regardless of case. All of them while nothing is typed, or while
 * the field holds one of them (a label already picked, e.g. the project's own when the settings open), so that the
 * other labels stay one click away.
 *
 * @param names - The label names to filter (see {@link collectGithubLabelNames}).
 * @param term - What the user typed.
 */
export function filterGithubLabelNames(names: ReadonlyArray<string>, term: unknown): string[] {
	const wanted = normalizeGithubLabelName(term).toLowerCase();
	if (!wanted || names.some((name) => name.toLowerCase() === wanted)) {
		return [...names];
	}
	return names.filter((name) => name.toLowerCase().includes(wanted));
}
