import { ISearchIndexRegistration, PermissionsEnum, SearchFieldKind } from '@gauzy/contracts';

/**
 * The product-variant declaration.
 *
 * A variant is what a buyer actually picks, so it is found by its SKU first and by the name of the
 * product it belongs to second, and it is narrowed by availability, by the invoicing policy and by the
 * product itself. The price is deliberately absent: a price is resolved for a channel and a currency at
 * the moment it is shown, so the index would hold a value that is stale in a way no rebuild can fix.
 */
export const PRODUCT_VARIANT_INDEX: ISearchIndexRegistration = {
	entity: 'product_variant',
	label: 'Product variants',
	permission: PermissionsEnum.ORG_INVENTORY_VIEW,
	relations: ['product', 'product.translations'],
	titleTemplate: '{{sku}} — {{name}}',
	bodyTemplate: '{{internalReference}}',
	keywordFields: ['sku', 'internalReference', 'enabled', 'billingInvoicingPolicy', 'productId'],
	sourceUpdatedAtField: 'updatedAt',
	channels: 'product_variant_channel',
	defaultWeight: 1,
	isSystem: true,
	isActive: true,
	fields: [
		{
			name: 'sku',
			kind: SearchFieldKind.KEYWORD,
			weight: 3,
			searchable: true,
			filterable: true,
			facetable: false
		},
		{
			name: 'name',
			kind: SearchFieldKind.TEXT,
			weight: 2,
			searchable: true,
			filterable: false,
			facetable: false,
			source: 'product.translations.name'
		},
		{
			name: 'internalReference',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: true,
			filterable: true,
			facetable: false
		},
		{
			name: 'enabled',
			kind: SearchFieldKind.BOOLEAN,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'billingInvoicingPolicy',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'productId',
			kind: SearchFieldKind.ENTITY,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		}
	]
};
