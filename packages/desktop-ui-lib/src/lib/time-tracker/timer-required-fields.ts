import { IValidationConfig } from '../shared/interfaces/validation.interface';

/** The organization switches the timer checks before it starts. A switch the organization does not carry is off. */
export interface ITimerRequirements {
	requireProject?: boolean;
	requireTask?: boolean;
	requireClient?: boolean;
	requireDescription?: boolean;
	requireTeam?: boolean;
}

/** The selectors whose value a switch can require. */
export interface ITimerFieldSources {
	project: unknown;
	task: unknown;
	client: unknown;
	note: unknown;
	team: unknown;
}

/**
 * Whether the organization requires a team on every time entry. Only an API that enforces it sends `requireTeam`, so
 * an organization without the field does not require a team.
 *
 * @param organization The organization the timer tracks for.
 */
export function isTeamRequired(organization: ITimerRequirements | null | undefined): boolean {
	return organization?.requireTeam === true;
}

/**
 * What the timer validates before it starts: each selector, with whether its switch is on.
 *
 * @param organization The organization the timer tracks for.
 * @param sources The selectors the timer starts from.
 */
export function timerRequiredFields(
	organization: ITimerRequirements,
	sources: ITimerFieldSources
): IValidationConfig[] {
	const requiresTeam = isTeamRequired(organization);
	return [
		{ service: sources.project, requireField: organization.requireProject },
		{ service: sources.task, requireField: organization.requireTask },
		{ service: sources.client, requireField: organization.requireClient },
		{ service: sources.note, requireField: organization.requireDescription },
		{ service: sources.team, requireField: requiresTeam }
	];
}
