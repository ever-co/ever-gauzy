import { ISearchIndexRegistration, PermissionsEnum, SearchFieldKind } from '@gauzy/contracts';

/**
 * The document declaration.
 *
 * A document is found by its display name and its original file name, and filtered by its kind, its
 * status and its media type. The extracted text a document may carry is deliberately not indexed: it is
 * derived content the document package owns and rebuilds, and the projection holds what a listing
 * shows rather than a second copy of a body somebody else maintains.
 */
export const DOCUMENT_INDEX: ISearchIndexRegistration = {
	entity: 'document',
	label: 'Documents',
	permission: PermissionsEnum.DOCS_READ,
	relations: ['tags'],
	titleTemplate: '{{name}}',
	bodyTemplate: '{{description}} {{originalFilename}}',
	keywordFields: ['originalFilename', 'mimeType', 'kind', 'status'],
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
			name: 'originalFilename',
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
			name: 'mimeType',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'kind',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
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
