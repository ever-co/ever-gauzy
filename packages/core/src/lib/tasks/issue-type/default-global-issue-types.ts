import { IIssueType, TaskTypeEnum } from '@gauzy/contracts';

export const DEFAULT_GLOBAL_ISSUE_TYPES: IIssueType[] = [
	{
		name: 'Bug',
		value: TaskTypeEnum.BUG,
		description:
			'A "bug type issue" typically refers to a specific type of technical issue that occurs in software development',
		icon: 'task-issue-types/bug.svg',
		color: '#C24A4A',
		isSystem: true,
		isDefault: false
	},
	{
		name: 'Story',
		value: TaskTypeEnum.STORY,
		description:
			'A "story (or user story) type issue" typically refers to an issue related to a user story in software development.',
		icon: 'task-issue-types/note.svg',
		color: '#54BA95',
		isSystem: true,
		isDefault: false
	},
	{
		name: 'Task',
		value: TaskTypeEnum.TASK,
		description: 'A "task type issue" typically refers to an issue related to a specific task within a project.',
		icon: 'task-issue-types/task-square.svg',
		color: '#5483BA',
		isSystem: true,
		isDefault: false
	},
	{
		name: 'Memo',
		value: TaskTypeEnum.MEMO,
		description:
			'Memos are short notes used to document ideas, discussions, or important details within a project.',
		icon: 'task-issue-types/category.svg',
		color: '#8154BA',
		isSystem: true,
		isDefault: false
	},
	{
		name: 'Epic',
		value: TaskTypeEnum.EPIC,
		description: 'An "epic type issue" typically refers to an issue related to an Epic in software development.',
		icon: 'task-issue-types/category.svg',
		color: '#8154BA',
		isSystem: true,
		isDefault: true
	}
];
