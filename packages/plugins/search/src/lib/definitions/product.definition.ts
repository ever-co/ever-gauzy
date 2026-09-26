import { ISearchIndexRegistration, PermissionsEnum, SearchFieldKind } from '@gauzy/contracts';

/**
 * The product declaration.
 *
 * A product is found by its name, its code and its tags, and narrowed by whether it is enabled and by
 * its category. The name and the description live on the translation rows, so the source paths read
 * through the relation: a document is built from the row the domain owns, and the declaration says
 * which part of it the index holds rather than the indexer knowing about translations.
 */
export const PRODUCT_INDEX: ISearchIndexRegistration = {
	entity: 'product',
	label: 'Products',
	permission: PermissionsEnum.ORG_INVENTORY_VIEW,
	relations: ['translations', 'tags', 'productCategory'],
	titleTemplate: '{{name}} — {{code}}',
	bodyTemplate: '{{description}}',
	keywordFields: ['code', 'tags', 'enabled', 'productCategoryId'],
	sourceUpdatedAtField: 'updatedAt',
	channels: 'product_channel',
	defaultWeight: 1,
	isSystem: true,
	isActive: true,
	fields: [
		{
			name: 'name',
			kind: SearchFieldKind.TEXT,
			weight: 3,
			searchable: true,
			filterable: false,
			facetable: false,
			source: 'translations.name'
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
			facetable: false,
			source: 'translations.description'
		},
		{
			name: 'tags',
			kind: SearchFieldKind.KEYWORD,
			weight: 2,
			searchable: true,
			filterable: true,
			facetable: true,
			source: 'tags.name'
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
			name: 'productCategoryId',
			kind: SearchFieldKind.ENTITY,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		}
	]
};
