import { ISearchIndexRegistration, PermissionsEnum, SearchFieldKind } from '@gauzy/contracts';

/**
 * The invoice declaration.
 *
 * An invoice is found by its number and by its terms, and filtered by the period it belongs to, by
 * whether it is a quote, by its status and by the party it is addressed to. `totalValue` is indexed for
 * narrowing and display only: it is a display value copied at index time, and anything that spends or
 * settles money re-reads the invoice from its own table.
 */
export const INVOICE_INDEX: ISearchIndexRegistration = {
	entity: 'invoice',
	label: 'Invoices',
	permission: PermissionsEnum.INVOICES_VIEW,
	relations: ['toContact'],
	titleTemplate: '{{invoiceNumber}} — {{currency}} {{totalValue}}',
	bodyTemplate: '{{terms}}',
	keywordFields: ['invoiceNumber', 'status', 'currency', 'isEstimate', 'organizationContactId'],
	sourceUpdatedAtField: 'updatedAt',
	defaultWeight: 1,
	isSystem: true,
	isActive: true,
	fields: [
		{
			name: 'invoiceNumber',
			kind: SearchFieldKind.KEYWORD,
			weight: 3,
			searchable: true,
			filterable: true,
			facetable: false
		},
		{
			name: 'terms',
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
			name: 'currency',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'isEstimate',
			kind: SearchFieldKind.BOOLEAN,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'totalValue',
			kind: SearchFieldKind.NUMBER,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: false
		},
		{
			name: 'invoiceDate',
			kind: SearchFieldKind.DATE,
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
			name: 'organizationContactId',
			kind: SearchFieldKind.ENTITY,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		}
	]
};
