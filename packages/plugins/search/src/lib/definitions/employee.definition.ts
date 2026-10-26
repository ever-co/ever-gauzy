import { ISearchIndexRegistration, PermissionsEnum, SearchFieldKind } from '@gauzy/contracts';

/**
 * The employee declaration.
 *
 * An employee is found by the name and the email address of the user behind the record, because that is
 * what a colleague searching for one types, and is narrowed by the level and by the period the
 * employment started in. No rate, bonus or income field is indexed: an indexed value is a display value,
 * and a person's compensation is not something a projection is allowed to leak.
 */
export const EMPLOYEE_INDEX: ISearchIndexRegistration = {
	entity: 'employee',
	label: 'Employees',
	permission: PermissionsEnum.ORG_EMPLOYEES_VIEW,
	relations: ['user', 'tags'],
	titleTemplate: '{{fullName}}',
	bodyTemplate: '{{email}} {{employeeLevel}}',
	keywordFields: ['email', 'employeeLevel', 'tags'],
	sourceUpdatedAtField: 'updatedAt',
	defaultWeight: 1,
	isSystem: true,
	isActive: true,
	fields: [
		{
			name: 'fullName',
			kind: SearchFieldKind.TEXT,
			weight: 3,
			searchable: true,
			filterable: true,
			facetable: false,
			source: 'user.name'
		},
		{
			name: 'email',
			kind: SearchFieldKind.KEYWORD,
			weight: 2,
			searchable: true,
			filterable: true,
			facetable: false,
			source: 'user.email'
		},
		{
			name: 'employeeLevel',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: true,
			filterable: true,
			facetable: true
		},
		{
			name: 'startedWorkOn',
			kind: SearchFieldKind.DATE,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: false
		},
		{
			name: 'tags',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: true,
			filterable: true,
			facetable: true,
			source: 'tags.name'
		}
	]
};
