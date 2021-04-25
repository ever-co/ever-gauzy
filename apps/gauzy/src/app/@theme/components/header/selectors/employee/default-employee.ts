//TODO: Currently the whole application assumes that if employee or id is null then you need to get data for All Employees
//That should not be the case, sometimes due to permissions like CHANGE_SELECTED_EMPLOYEE not being available
//we need to handle cases where No Employee is selected too

import { DEFAULT_TYPE, ISelectedEmployee } from '@gauzy/contracts';

export const ALL_EMPLOYEES_SELECTED: ISelectedEmployee = {
	id: null,
	firstName: 'All Employees',
	lastName: '',
	imageUrl: 'https://i.imgur.com/XwA2T62.jpg',
	defaultType: DEFAULT_TYPE.ALL_EMPLOYEE,
	tags: [],
	skills: []
};

export const NO_EMPLOYEE_SELECTED: ISelectedEmployee = {
	id: null,
	firstName: '',
	lastName: '',
	imageUrl: '',
	defaultType: DEFAULT_TYPE.NO_EMPLOYEE,
	tags: [],
	skills: []
};
