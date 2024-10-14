import { ActionTypeEnum, BaseEntityEnum, IActivityLogUpdatedValues } from '@gauzy/contracts';

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

export function activityLogUpdatedFieldsAndValues<T>(original: T, updated: Partial<T>) {
	const updatedFields: string[] = [];
	const previousValues: IActivityLogUpdatedValues[] = [];
	const updatedValues: IActivityLogUpdatedValues[] = [];

	for (const key of Object.keys(updated)) {
		if (original[key] !== updated[key]) {
			// Add updated field
			updatedFields.push(key);

			// Add old and new values
			previousValues.push({ [key]: original[key] });
			updatedValues.push({ [key]: updated[key] });
		}
	}

	return { updatedFields, previousValues, updatedValues };
}
