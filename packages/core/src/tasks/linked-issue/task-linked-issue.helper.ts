import { TaskRelatedIssuesRelationEnum } from '@gauzy/contracts';

/**
 * Maps a task's related issue relation enum to a corresponding string description.
 *
 * @param {TaskRelatedIssuesRelationEnum} relation - The relation type from the enum `TaskRelatedIssuesRelationEnum`.
 * @returns {string} The corresponding string description for the given relation type.
 */
export function taskRelatedIssueRelationMap(relation: TaskRelatedIssuesRelationEnum): string {
	const issueRelationMap: { [key in TaskRelatedIssuesRelationEnum]: string } = {
		[TaskRelatedIssuesRelationEnum.BLOCKS]: 'Blocks',
		[TaskRelatedIssuesRelationEnum.CLONES]: 'Clones',
		[TaskRelatedIssuesRelationEnum.DUPLICATES]: 'Duplicates',
		[TaskRelatedIssuesRelationEnum.IS_BLOCKED_BY]: 'Is Blocked By',
		[TaskRelatedIssuesRelationEnum.IS_CLONED_BY]: 'Is cloned By',
		[TaskRelatedIssuesRelationEnum.IS_DUPLICATED_BY]: 'Is Duplicated By',
		[TaskRelatedIssuesRelationEnum.RELATES_TO]: 'Relates To'
	};

	return issueRelationMap[relation];
}
