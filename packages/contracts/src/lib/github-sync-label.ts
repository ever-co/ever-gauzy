import { SyncTags } from '@gauzy/constants';

/**
 * The longest label name GitHub accepts: its API refuses a longer one ("name is too long (maximum is 50 characters)").
 */
export const GITHUB_LABEL_NAME_MAX_LENGTH = 50;

/** Whether a character is a C0 / C1 control character (a line break, a tab, ...): a label is one line of text. */
function isControlCharacter(character: string): boolean {
	const code = character.codePointAt(0);
	return code < 0x20 || (code >= 0x7f && code <= 0x9f);
}

/**
 * A GitHub label name the way the GitHub sync stores and compares it: without surrounding whitespace.
 *
 * @param name - What the user typed, or what a project or an issue label carries.
 * @returns The trimmed name, or `''` when there is none (not a string, or only whitespace).
 */
export function normalizeGithubLabelName(name: unknown): string {
	return typeof name === 'string' ? name.trim() : '';
}

/**
 * Whether GitHub accepts the name for a label: one line of at most {@link GITHUB_LABEL_NAME_MAX_LENGTH}
 * characters once trimmed (counted in code points, as GitHub counts them, so an emoji is one character).
 *
 * @param name - The label name to check.
 */
export function isValidGithubLabelName(name: unknown): boolean {
	const characters = Array.from(normalizeGithubLabelName(name));
	return (
		characters.length > 0 &&
		characters.length <= GITHUB_LABEL_NAME_MAX_LENGTH &&
		!characters.some(isControlCharacter)
	);
}

/**
 * The label a project syncs GitHub issues on: the one it chose (`syncTag`), else the default label
 * (`SyncTags.GAUZY`), which every repository sync of the GitHub integration page used to store on the project.
 *
 * @param syncTag - The project's own sync label, if any.
 * @returns The trimmed chosen label, or the default one when the project has none.
 */
export function resolveGithubSyncLabel(syncTag?: string | null): string {
	return normalizeGithubLabelName(syncTag) || SyncTags.GAUZY;
}

/**
 * Whether a GitHub issue carries the sync label. Names are compared once trimmed and otherwise exactly, as the
 * GitHub sync always compared them.
 *
 * @param labels - The issue's labels.
 * @param syncLabel - The label to look for (see {@link resolveGithubSyncLabel}).
 */
export function hasGithubSyncLabel(
	labels: ReadonlyArray<{ name?: string | null }> | null | undefined,
	syncLabel: string
): boolean {
	const wanted = normalizeGithubLabelName(syncLabel);
	return !!wanted && (labels ?? []).some((label) => normalizeGithubLabelName(label?.name) === wanted);
}
