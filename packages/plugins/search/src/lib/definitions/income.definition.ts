import { ISearchIndexRegistration, PermissionsEnum, SearchFieldKind } from '@gauzy/contracts';

/**
 * The income declaration.
 *
 * Income is found by the client it came from and by its notes, and filtered by the period it belongs to,
 * by whether it is a bonus, and by the tags it carries. The client is a relation, so the source path
 * reads through it — the declaration says where the value lives, instead of the indexer assuming.
 */
export const INCOME_INDEX: ISearchIndexRegistration = {
	entity: 'income',
	label: 'Income',
	permission: PermissionsEnum.ORG_INCOMES_VIEW,
	relations: ['client', 'tags'],
	titleTemplate: '{{client}} — {{amount}} {{currency}}',
	bodyTemplate: '{{notes}} {{reference}}',
	keywordFields: ['currency', 'isBonus', 'clientId', 'employeeId', 'tags'],
	sourceUpdatedAtField: 'updatedAt',
	defaultWeight: 1,
	isSystem: true,
	isActive: true,
	fields: [
		{
			name: 'client',
			kind: SearchFieldKind.TEXT,
			weight: 3,
			searchable: true,
			filterable: false,
			facetable: false,
			source: 'client.name'
		},
		{
			name: 'notes',
			kind: SearchFieldKind.TEXT,
			weight: 2,
			searchable: true,
			filterable: false,
			facetable: false
		},
		{
			name: 'reference',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: true,
			filterable: true,
			facetable: false
		},
		{
			name: 'amount',
			kind: SearchFieldKind.NUMBER,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: false
		},
		{
			name: 'currency',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'valueDate',
			kind: SearchFieldKind.DATE,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: false
		},
		{
			name: 'isBonus',
			kind: SearchFieldKind.BOOLEAN,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'clientId',
			kind: SearchFieldKind.ENTITY,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'employeeId',
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
