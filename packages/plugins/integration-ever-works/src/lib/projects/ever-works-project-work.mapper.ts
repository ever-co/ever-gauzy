import { createHash } from 'node:crypto';
import { ID } from '@gauzy/contracts';
import { EVER_WORKS_LINK_SOURCE } from '../ever-works.constants';
import type { EverWorksTeamScope } from '../teams/ever-works-team-scope';

/** The repo-less Work kind a Gauzy project is created as in Ever Works (EW-P2-4). */
export const EVER_WORKS_PROJECT_WORK_KIND = 'project';

/** Ever Works' limits on a work (contract v1 work DTO). */
export const EVER_WORKS_WORK_NAME_MAX = 255;
export const EVER_WORKS_WORK_WEBSITE_MAX = 2048;

/** The fields of a Gauzy project a new Ever Works work is created from. */
export interface GauzyProjectForWork {
	id: ID;
	name?: string | null;
	description?: string | null;
	projectUrl?: string | null;
}

/**
 * `POST /works` body (contract v1 B.6 "P2: `POST /works` with `kind:'project'`", CR-4): a repo-less
 * Work of kind `project`, scoped by the project's teams (D11: on a team → `team`, else
 * `organization`), linked back to the Gauzy project through `externalRef`. Only the shared fields of
 * plan 01 §10 are sent; Ever Works derives the slug, and its owner is the act-as user (or the
 * integration).
 */
export function projectWorkCreateBody(
	project: GauzyProjectForWork,
	scope: EverWorksTeamScope,
	connectionId: ID
): Record<string, unknown> {
	const name = (project.name ?? '').trim().slice(0, EVER_WORKS_WORK_NAME_MAX);
	const description = (project.description ?? '').trim();
	const website = (project.projectUrl ?? '').trim();
	return {
		kind: EVER_WORKS_PROJECT_WORK_KIND,
		name,
		description: description || null,
		// A website Ever Works would refuse (too long, not http(s)) is left out rather than failing the create.
		...(website && website.length <= EVER_WORKS_WORK_WEBSITE_MAX && /^https?:\/\//i.test(website)
			? { website }
			: {}),
		teamIds: scope.teamIds,
		visibility: scope.visibility,
		externalRef: { source: EVER_WORKS_LINK_SOURCE, installationId: connectionId, externalId: project.id }
	};
}

/**
 * The `Idempotency-Key` of a project's work create (plan 03 §C.3): the same for every retry of the same
 * request, so a lost answer never creates a second work. Ever Works refuses a key reused with another
 * body (`409 conflict`), so the body is part of it: a retry after the project was renamed is a new
 * request, and `externalRef` still answers the same work. The create retried without act-as
 * (`403 act_as_forbidden`) gets its own key as well.
 */
export function projectWorkIdempotencyKey(
	connectionId: ID,
	projectId: ID,
	body: Record<string, unknown>,
	actor: 'user' | 'integration' = 'user'
): string {
	return createHash('sha256')
		.update(`${connectionId}:PROJECT_WORK:${projectId}:create:${actor}:${JSON.stringify(body)}`)
		.digest('hex');
}

/**
 * Whether an Ever Works refusal means the repo-less kind is switched off on that installation
 * (`EVER_WORKS_PROJECT_WORKS_ENABLED`, default off in Ever Works).
 */
export function isProjectWorksDisabled(
	error: { code?: string; message?: string; details?: Record<string, unknown> } | null | undefined
): boolean {
	if (!error) return false;
	const reason = typeof error.details?.['reason'] === 'string' ? (error.details['reason'] as string) : '';
	return [error.code, reason, error.message].some(
		(value) => !!value && /project_works_disabled|EVER_WORKS_PROJECT_WORKS_ENABLED/i.test(value)
	);
}
