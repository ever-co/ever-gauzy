import { ISearchIndexRegistration, PermissionsEnum, SearchFieldKind } from '@gauzy/contracts';

/**
 * The party declaration.
 *
 * A party is found by its name, its email address and its phone number, which are the three things a
 * person actually types when they are looking for one, and is narrowed by the kind of relationship it
 * is and by how it was tagged.
 */
export const ORGANIZATION_CONTACT_INDEX: ISearchIndexRegistration = {
	entity: 'organization_contact',
	label: 'Contacts',
	permission: PermissionsEnum.ORG_CONTACT_VIEW,
	relations: ['tags'],
	titleTemplate: '{{name}}',
	bodyTemplate: '{{primaryEmail}} {{notes}}',
	keywordFields: ['primaryEmail', 'primaryPhone', 'contactType', 'tags'],
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
			name: 'primaryEmail',
			kind: SearchFieldKind.KEYWORD,
			weight: 2,
			searchable: true,
			filterable: true,
			facetable: false
		},
		{
			name: 'primaryPhone',
			kind: SearchFieldKind.KEYWORD,
			weight: 2,
			searchable: true,
			filterable: true,
			facetable: false
		},
		{
			name: 'contactType',
			kind: SearchFieldKind.KEYWORD,
			weight: 1,
			searchable: false,
			filterable: true,
			facetable: true
		},
		{
			name: 'notes',
			kind: SearchFieldKind.TEXT,
			weight: 1,
			searchable: true,
			filterable: false,
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
