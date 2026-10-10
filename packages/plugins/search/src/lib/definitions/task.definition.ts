import { ISearchIndexRegistration, PermissionsEnum, SearchFieldKind } from '@gauzy/contracts';

/**
 * The task declaration.
 *
 * A task is found by its title and its description and by its number, and filtered by its status, its
 * priority, its size and the project it belongs to — which is the set of narrowings a task board
 * actually offers.
 */
export const TASK_INDEX: ISearchIndexRegistration = {
	entity: 'task',
	label: 'Tasks',
	permission: PermissionsEnum.ORG_TASK_VIEW,
	relations: ['project', 'tags'],
	titleTemplate: '{{title}}',
	bodyTemplate: '{{description}} {{number}}',
	keywordFields: ['number', 'status', 'priority', 'size', 'projectId', 'tags'],
	sourceUpdatedAtField: 'updatedAt',
	defaultWeight: 1,
	isSystem: true,
	isActive: true,
	fields: [
		{
			name: 'title',
			kind: SearchFieldKind.TEXT,
			weight: 3,
			searchable: true,
			filterable: true,
			facetable: false
		},
		{
			name: 'number',
			kind: SearchFieldKind.KEYWORD,
			weight: 2,
			searchable: true,
			filterable: true,
			facetable: false,
			source: 'taskNumber'
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
			name: 'priority',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'size',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'estimate',
			kind: SearchFieldKind.NUMBER,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: false
		},
		{
			name: 'dueDate',
			kind: SearchFieldKind.DATE,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: false
		},
		{
			name: 'projectId',
			kind: SearchFieldKind.ENTITY,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
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
