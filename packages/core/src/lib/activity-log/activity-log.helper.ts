import { ActionTypeEnum, BaseEntityEnum, IActivityLogUpdatedValues } from '@gauzy/contracts';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';

const ActivityTemplates = {
	[ActionTypeEnum.Created]: `{action} a new {entity} called "{entityName}"`,
	[ActionTypeEnum.Updated]: `{action} {entity} "{entityName}"`,
	[ActionTypeEnum.Deleted]: `{action} {entity} "{entityName}"`
};

/**
 * Generates an activity description based on the action type, entity, and entity name.
 * @param action - The action performed (e.g., CREATED, UPDATED, DELETED).
 * @param entity - The type of entity involved in the action (e.g., Project, User).
 * @param entityName - The name of the specific entity instance.
 * @returns A formatted description string.
 */
export function generateActivityLogDescription(
	action: ActionTypeEnum,
	entity: BaseEntityEnum,
	entityName: string
): string {
	// Get the template corresponding to the action
	const template = ActivityTemplates[action] || '{action} {entity} "{entityName}"';

	// Replace placeholders in the template with actual values
	return template.replace(/\{(\w+)\}/g, (_, key) => {
		switch (key) {
			case 'action':
				return action;
			case 'entity':
				return entity;
			case 'entityName':
				return entityName;
			default:
				return '';
		}
	});
}

/**
 * @description Log updated field names, old and new values for Activity Log Updated Actions
 * @template T
 * @param {T} originalValues - Old values before update
 * @param {Partial<T>} updated - Updated values
 * @returns An object with updated fields, their old and new values
 */
export function activityLogUpdatedFieldsAndValues<T>(originalValues: T, updated: Partial<T>) {
	const updatedFields: string[] = [];
	const previousValues: IActivityLogUpdatedValues[] = [];
	const updatedValues: IActivityLogUpdatedValues[] = [];

	for (const key of Object.keys(updated)) {
		if (originalValues[key] !== updated[key]) {
			// Add updated field
			updatedFields.push(key);

			// Add old and new values
			previousValues.push({ [key]: originalValues[key] });
			updatedValues.push({ [key]: updated[key] });
		}
	}

	return { updatedFields, previousValues, updatedValues };
}

/**
 * @description Sanitizes entity data for activity logging to prevent SQLite's
 * "Too many parameter values" error (SQLITE_MAX_VARIABLE_NUMBER = 999).
 *
 * For SQLite/BetterSQLite3 only:
 * - Replaces relation arrays (objects with 'id') with arrays of IDs
 * - Keeps only primitive values and dates
 * - Skips nested relation objects (already have xxxId fields)
 *
 * @template T - The entity type
 * @param {T} entity - The entity to sanitize
 * @returns {T | Record<string, any>} - Original entity for non-SQLite DBs, sanitized object for SQLite
 */
export function sanitizeEntityForActivityLog<T>(entity: T): T | Record<string, any> {
	// Only sanitize for SQLite/BetterSQLite3
	if (!isSqlite() && !isBetterSqlite3()) {
		return entity;
	}

	if (!entity || typeof entity !== 'object') {
		return entity;
	}

	const sanitized: Record<string, any> = {};

	for (const [key, value] of Object.entries(entity as Record<string, any>)) {
		// Skip null/undefined values
		if (value === null || value === undefined) {
			sanitized[key] = value;
			continue;
		}

		// If it's an array of objects with 'id' property, extract only the IDs
		if (
			Array.isArray(value) &&
			value.length > 0 &&
			typeof value[0] === 'object' &&
			value[0] !== null &&
			'id' in value[0]
		) {
			sanitized[`${key}Ids`] = value.map((item) => item.id);
			continue;
		}

		// Skip relation objects (entity likely already has a xxxId field for this)
		if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && 'id' in value) {
			continue;
		}

		// Keep primitive values and dates
		if (typeof value !== 'object' || value instanceof Date) {
			sanitized[key] = value;
		}

		// Skip other complex objects to reduce bind parameters
	}

	return sanitized;
}
