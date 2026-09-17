import { PermissionsEnum } from '@gauzy/contracts';
import { PluginPermissionContribution } from '@gauzy/plugin';

/**
 * Carries a permission value this plugin declares.
 *
 * The platform's permission catalogue is a closed enumeration and this package must not edit it. A
 * plugin's permissions are contributed through the plugin metadata and unioned into the catalogue at
 * bootstrap, so the value is an ordinary string by the time a guard reads it. The cast states exactly
 * that: the value is a declared permission, not a member of the static enum.
 *
 * @param value The permission value.
 * @returns The value in the shape the guard reads its metadata in.
 */
const permission = (value: string): PermissionsEnum => value as PermissionsEnum;

/**
 * The permissions this plugin declares.
 *
 * `SEARCH_VIEW` is the ordinary reader's grant: running a query, asking for suggestions, asking for
 * facets and reading how fresh the index is. The other three are operator grants, and they are split
 * because the three things they authorise fail differently. Reading a declaration is not editing one,
 * and neither is rebuilding an index: an operator who may look at why an entity ranks the way it does
 * must not therefore be able to change its weights, and an operator who may change a weight must not
 * silently be able to rebuild every index in the tenant.
 */
export const SEARCH_PERMISSIONS = {
	/** Run a search, ask for suggestions and facets, and read index status. */
	SEARCH_VIEW: permission('SEARCH_VIEW'),
	/** Trigger a rebuild of one entity's index or of every index, and drop an index. */
	SEARCH_REINDEX: permission('SEARCH_REINDEX'),
	/** Read which entity fields are indexed, with their weights and flags. */
	SEARCH_INDEX_DEFINITIONS_VIEW: permission('SEARCH_INDEX_DEFINITIONS_VIEW'),
	/** Declare, re-weight, deactivate or remove an index definition. */
	SEARCH_INDEX_DEFINITIONS_EDIT: permission('SEARCH_INDEX_DEFINITIONS_EDIT')
} as const;

/**
 * The permission values the guards and the resolvers read.
 *
 * They are the same values {@link SEARCH_PERMISSIONS} holds and the same ones the catalogue below
 * contributes; naming them once is what stops a guard and its catalogue entry from drifting apart.
 */
export const SearchPermissions = SEARCH_PERMISSIONS;

/**
 * The permission catalogue entries this plugin contributes to the platform role model.
 *
 * A declared `defaultFor` role receives the permission when a tenant is provisioned from scratch;
 * existing tenants receive it through the permission reload, which only ever inserts missing rows.
 */
export const SEARCH_PERMISSION_CONTRIBUTIONS: PluginPermissionContribution[] = [
	{
		value: 'SEARCH_VIEW',
		label: 'Search the platform',
		group: 'GENERAL',
		description:
			'Run a search across the indexed entities, ask for type-ahead suggestions and facet counts, and read how fresh each index is.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']
	},
	{
		value: 'SEARCH_REINDEX',
		label: 'Rebuild the search index',
		group: 'ADMINISTRATION',
		description:
			'Rebuild one entity type, one channel or every indexed entity, and drop the documents of an entity or a channel.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'SEARCH_INDEX_DEFINITIONS_VIEW',
		label: 'View search index definitions',
		group: 'ADMINISTRATION',
		description: 'Read which entity fields the search index holds, with their weights and their searchable, filterable and facetable flags.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: 'SEARCH_INDEX_DEFINITIONS_EDIT',
		label: 'Edit search index definitions',
		group: 'ADMINISTRATION',
		description:
			'Declare an index definition, re-weight its fields, deactivate it or remove it. A seeded definition may be deactivated but never deleted.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	}
];
