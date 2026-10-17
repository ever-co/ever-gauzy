import { ID } from '@gauzy/contracts';
import { EverWorksSettingName } from '../ever-works-setting.enum';
import type { EverWorksMappingContext } from '../mapping/ever-works-mapping-context.service';
import { EverWorksLinkState, EverWorksLinkType } from '../sync/entities/ever-works-sync.entities';
import type { EverWorksLinkService } from '../sync/links/ever-works-link.service';

/** The fields of a Gauzy task the exclusion rule reads. */
export interface EverWorksTaskExclusionInput {
	issueType?: string | null;
	taskTypeId?: ID | string | null;
	projectId?: ID | string | null;
}

/**
 * Why a Gauzy task is not pushed to Ever Works at all, or `null` when it is (plan 01 §7, §8): an idea syncs as an
 * Ever Works idea, and a task of a project not linked to a work only when the mapping allows it. Shared by the task
 * handler and the comment handler, whose comments of such a task never wait for it (review F22).
 */
export async function taskSyncExclusion(
	links: Pick<EverWorksLinkService, 'byGauzy'>,
	context: EverWorksMappingContext,
	task: EverWorksTaskExclusionInput
): Promise<string | null> {
	const setting = (name: EverWorksSettingName) =>
		context.mapping.settings?.find((row) => row.settingsName === name)?.settingsValue ?? '';
	const ideaTypeId = setting(EverWorksSettingName.IDEA_ISSUE_TYPE_ID);
	if (String(task.issueType ?? '').toLowerCase() === 'idea' || (ideaTypeId && task.taskTypeId === ideaTypeId)) {
		return 'ideas sync as Ever Works ideas (plan 01 §8), not as tasks';
	}
	const projectLink = task.projectId
		? await links.byGauzy(context.integrationTenantId, EverWorksLinkType.PROJECT_WORK, task.projectId as ID)
		: null;
	const linkedProject = !!projectLink && projectLink.state !== EverWorksLinkState.UNLINKED;
	if (!linkedProject && setting(EverWorksSettingName.SYNC_UNLINKED_PROJECT_TASKS) === 'false') {
		return 'tasks of projects not linked to a work are not synced (setting)';
	}
	return null;
}
