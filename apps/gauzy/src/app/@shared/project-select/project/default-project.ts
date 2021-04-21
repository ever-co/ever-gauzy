import { IOrganizationProject, TaskListTypeEnum } from '@gauzy/contracts';

export const ALL_PROJECT_SELECTED: IOrganizationProject = {
	id: 'all',
	currency: null,
	billing: null,
	public: true,
	owner: null,
	name: 'All Projects',
	tags: [],
	taskListType: TaskListTypeEnum.GRID
};
