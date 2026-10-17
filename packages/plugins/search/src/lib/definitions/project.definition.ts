import { ISearchIndexRegistration, PermissionsEnum, SearchFieldKind } from '@gauzy/contracts';

/**
 * The project declaration.
 *
 * A project is found by its name, its code and its description, and filtered by its status, by whether
 * it is billable and by the period it runs in. The budget is indexed for narrowing and display only; no
 * money movement is ever computed from an indexed value.
 */
export const PROJECT_INDEX: ISearchIndexRegistration = {
	entity: 'project',
	label: 'Projects',
	permission: PermissionsEnum.ORG_PROJECT_VIEW,
	relations: ['tags'],
	titleTemplate: '{{name}} — {{code}}',
	bodyTemplate: '{{description}}',
	keywordFields: ['code', 'status', 'billable', 'tags'],
	sourceUpdatedAtField: 'updatedAt',
	defaultWeight: 1,
	isSystem: true,
	isActive: true,
	fields: [
		{
			name: 'name',
			kind: SearchFieldKind.TEXT,
			weight: 3,
			searchable: true,
			filterable: true,
			facetable: false
		},
		{
			name: 'code',
			kind: SearchFieldKind.KEYWORD,
			weight: 2,
			searchable: true,
			filterable: true,
			facetable: false
		},
		{
			name: 'description',
			kind: SearchFieldKind.TEXT,
			weight: 1,
			searchable: true,
			filterable: false,
			facetable: false
		},
		{
			name: 'status',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'billable',
			kind: SearchFieldKind.BOOLEAN,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'budget',
			kind: SearchFieldKind.NUMBER,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: false
		},
		{
			name: 'startDate',
			kind: SearchFieldKind.DATE,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: false
		},
		{
			name: 'endDate',
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
