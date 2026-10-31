import { ID, IOrganizationProject } from '@gauzy/contracts';

/**
 * Whether `project` may stay selected once the dialog's project list is narrowed to the client
 * `organizationContactId`.
 *
 * No client means no narrowing, so every project stays (the dialog's default). With a client, the
 * project must belong to it: a project of another client, or of no client, is no longer listed.
 *
 * @param project The selected project, if any.
 * @param organizationContactId The client the project list is narrowed to, if any.
 * @returns `true` when the project can stay selected, `false` when it should be cleared.
 */
export function isProjectOfClient(
	project: Pick<IOrganizationProject, 'organizationContactId' | 'organizationContact'> | null | undefined,
	organizationContactId: ID | null | undefined
): boolean {
	if (!organizationContactId || !project) {
		return true;
	}
	return (project.organizationContactId ?? project.organizationContact?.id) === organizationContactId;
}
