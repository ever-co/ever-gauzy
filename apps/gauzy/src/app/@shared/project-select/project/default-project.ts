import { IOrganizationProject } from '@gauzy/contracts';

export const ALL_PROJECT_SELECTED: IOrganizationProject = {
	id: null,
	currency: null,
	billing: null,
	public: true,
	owner: null,
	name: 'All Projects',
	tags: [],
	taskListType: null
};

export const NO_PROJECT_SELECTED: IOrganizationProject = {
	id: null,
	currency: null,
	billing: null,
	public: true,
	owner: null,
	name: '',
	tags: [],
	taskListType: null
};
