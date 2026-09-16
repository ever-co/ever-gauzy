/**
 * Metadata keys used in plugins for defining various aspects like entities, subscribers, and configurations.
 */
export const PLUGIN_METADATA = {
	/**
	 * Key representing the entities registered within the plugin.
	 */
	ENTITIES: 'entities',

	/**
	 * Key representing event subscribers within the plugin.
	 */
	SUBSCRIBERS: 'subscribers',

	/**
	 * Key representing the extensions registered within the plugin.
	 */
	EXTENSIONS: 'extensions',

	/**
	 * Key representing configuration settings of the plugin.
	 */
	CONFIGURATION: 'configuration',

	/**
	 * Key representing the database migrations the plugin owns.
	 */
	MIGRATIONS: 'migrations',

	/**
	 * Key representing the permissions the plugin contributes to the role model.
	 */
	PERMISSIONS: 'permissions',

	/**
	 * Key representing the feature flags the plugin contributes.
	 */
	FEATURES: 'features',

	/**
	 * Key representing the settings the plugin reads.
	 */
	SETTINGS: 'settings',

	/**
	 * Key representing the plugins this plugin requires to be loaded first.
	 */
	DEPENDS_ON: 'dependsOn'
} as const;

/**
 * Type definition for valid plugin metadata keys.
 */
export type PluginMetadataKey = (typeof PLUGIN_METADATA)[keyof typeof PLUGIN_METADATA];
