import { ISearchIndexRegistration, PermissionsEnum, SearchFieldKind } from '@gauzy/contracts';

/**
 * The expense declaration.
 *
 * An expense is found by the vendor it was paid to and by its notes, and filtered by the period it
 * belongs to, by its status and by who incurred it. `amount` is indexed so a listing can show it and so
 * a range filter can narrow on it; it is never the value an accounting entry is computed from.
 */
export const EXPENSE_INDEX: ISearchIndexRegistration = {
	entity: 'expense',
	label: 'Expenses',
	permission: PermissionsEnum.ORG_EXPENSES_VIEW,
	relations: ['vendor', 'category'],
	titleTemplate: '{{vendor}} — {{amount}} {{currency}}',
	bodyTemplate: '{{notes}} {{purpose}}',
	keywordFields: ['currency', 'status', 'vendorId', 'employeeId', 'categoryId'],
	sourceUpdatedAtField: 'updatedAt',
	defaultWeight: 1,
	isSystem: true,
	isActive: true,
	fields: [
		{
			name: 'vendor',
			kind: SearchFieldKind.TEXT,
			weight: 3,
			searchable: true,
			filterable: false,
			facetable: false,
			source: 'vendor.name'
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
			name: 'purpose',
			kind: SearchFieldKind.TEXT,
			weight: 1,
			searchable: true,
			filterable: false,
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
			name: 'status',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'vendorId',
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
			name: 'categoryId',
			kind: SearchFieldKind.ENTITY,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true,
			source: 'categoryId'
		}
	]
};
