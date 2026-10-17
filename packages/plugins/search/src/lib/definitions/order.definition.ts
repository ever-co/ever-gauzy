import { ISearchIndexRegistration, SearchFieldKind } from '@gauzy/contracts';

/**
 * The grant a caller needs in order to see an order in a search result.
 *
 * The value is written out rather than read from an enumeration because the order capability and its
 * permission catalogue are contributed by the package that owns the order, and this package must not
 * depend on it: the declaration names the grant, and the platform unions the two catalogues at
 * bootstrap, so the value is an ordinary permission by the time a guard reads it.
 */
const ORDERS_VIEW = 'ORDERS_VIEW';

/**
 * The order declaration.
 *
 * An order is found by its number and by the email address it was placed with, and filtered by its
 * status, by its currency, by the buyer and by the channel it belongs to. `grandTotal` is indexed so a
 * listing can show it and a range filter can narrow on it; it is a display value, and the checkout and
 * settlement paths recompute every total from the order's own rows.
 */
export const ORDER_INDEX: ISearchIndexRegistration = {
	entity: 'order',
	label: 'Orders',
	permission: ORDERS_VIEW,
	titleTemplate: '{{number}} — {{grandTotal}} {{currency}}',
	bodyTemplate: '{{email}}',
	keywordFields: ['number', 'status', 'currency', 'customerId', 'channelId'],
	sourceUpdatedAtField: 'updatedAt',
	defaultWeight: 1,
	isSystem: true,
	isActive: true,
	fields: [
		{
			name: 'number',
			kind: SearchFieldKind.KEYWORD,
			weight: 3,
			searchable: true,
			filterable: true,
			facetable: false
		},
		{
			name: 'email',
			kind: SearchFieldKind.KEYWORD,
			weight: 2,
			searchable: true,
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
			name: 'currency',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'grandTotal',
			kind: SearchFieldKind.NUMBER,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: false
		},
		{
			name: 'placedAt',
			kind: SearchFieldKind.DATE,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: false,
			source: 'createdAt'
		},
		{
			name: 'customerId',
			kind: SearchFieldKind.ENTITY,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'channelId',
			kind: SearchFieldKind.ENTITY,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		}
	]
};
