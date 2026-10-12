import { PermissionsEnum } from '@gauzy/contracts';
import { PluginPermissionContribution } from '@gauzy/plugin';

/**
 * The permission values the catalog plugin grants.
 *
 * Product and variant authoring, publication, media, relations and the category tree are all edits of
 * the product resource, so they share the product permissions instead of splitting into one
 * permission per pivot table: a role that may edit a product may say where it is published, and a
 * separate `PRODUCTS_PUBLISH` would double every catalogue role definition for one endpoint pair.
 * Collections are a resource with their own lifecycle and therefore carry their own four values.
 */
export const CATALOG_PERMISSION_VALUES = {
	PRODUCTS_VIEW: 'PRODUCTS_VIEW',
	PRODUCTS_EDIT: 'PRODUCTS_EDIT',
	PRODUCTS_DELETE: 'PRODUCTS_DELETE',
	PRODUCTS_BULK_IMPORT: 'PRODUCTS_BULK_IMPORT',
	COLLECTIONS_VIEW: 'COLLECTIONS_VIEW',
	COLLECTIONS_CREATE: 'COLLECTIONS_CREATE',
	COLLECTIONS_EDIT: 'COLLECTIONS_EDIT',
	COLLECTIONS_DELETE: 'COLLECTIONS_DELETE'
} as const;

/**
 * Presents a catalog permission value as a platform permission.
 *
 * The value is declared by this plugin and unioned into the platform permission catalogue at
 * bootstrap, so the plugin never edits the platform enum to register itself. The cast is what lets a
 * controller carry `@Permissions(...)` over a value the enum has not been taught yet.
 *
 * @param value One of `CATALOG_PERMISSION_VALUES`.
 * @returns The value, typed as a platform permission.
 */
export function catalogPermission(value: string): PermissionsEnum {
	return value as PermissionsEnum;
}

/**
 * The catalog plugin's contribution to the platform permission catalogue.
 */
export const CATALOG_PERMISSIONS: PluginPermissionContribution[] = [
	{
		value: CATALOG_PERMISSION_VALUES.PRODUCTS_VIEW,
		label: 'View products',
		group: 'GENERAL',
		description:
			'Read products, variants, options, media, categories and relations, and export a product file.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: CATALOG_PERMISSION_VALUES.PRODUCTS_EDIT,
		label: 'Edit products',
		group: 'GENERAL',
		description:
			'Create, update and archive products, variants, options and media, maintain relations, and publish or withdraw a product or variant on a channel.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: CATALOG_PERMISSION_VALUES.PRODUCTS_DELETE,
		label: 'Delete products',
		group: 'GENERAL',
		description: 'Delete a product or a variant.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: CATALOG_PERMISSION_VALUES.PRODUCTS_BULK_IMPORT,
		label: 'Bulk import products',
		group: 'ADMINISTRATION',
		description: 'Run the catalog bulk endpoint.',
		defaultFor: ['SUPER_ADMIN']
	},
	{
		value: CATALOG_PERMISSION_VALUES.COLLECTIONS_VIEW,
		label: 'View collections',
		group: 'GENERAL',
		description: 'Read collections, their membership and their rule previews.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: CATALOG_PERMISSION_VALUES.COLLECTIONS_CREATE,
		label: 'Create collections',
		group: 'GENERAL',
		description: 'Create a collection.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: CATALOG_PERMISSION_VALUES.COLLECTIONS_EDIT,
		label: 'Edit collections',
		group: 'GENERAL',
		description: 'Update a collection, its product and variant sets and its channel publications.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	},
	{
		value: CATALOG_PERMISSION_VALUES.COLLECTIONS_DELETE,
		label: 'Delete collections',
		group: 'GENERAL',
		description: 'Delete a collection.',
		defaultFor: ['SUPER_ADMIN', 'ADMIN']
	}
];
