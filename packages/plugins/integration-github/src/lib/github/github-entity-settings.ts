import { IntegrationEntity } from '@gauzy/contracts';

/**
 * Default settings for entities that will be synchronized.
 * This constant defines the default configuration for entities that are integrated with external systems.
 * By default, issues are set to be synchronized.
 */
export const DEFAULT_ENTITY_SETTINGS = [
	{
		entity: IntegrationEntity.ISSUE, // Represents an issue entity that is integrated with an external system
		sync: true // Indicates that this entity should be synchronized
	}
];

/**
 * Entities that are tied to issues and should be synchronized together.
 * This constant defines additional entities that are associated with issues and should be synchronized
 * when issues are synchronized. Labels are set to be synchronized by default.
 */
export const ISSUE_TIED_ENTITIES = [
	{
		entity: IntegrationEntity.LABEL, // Represents a label entity that is tied to an issue
		sync: true // Indicates that this entity should be synchronized
	}
];
