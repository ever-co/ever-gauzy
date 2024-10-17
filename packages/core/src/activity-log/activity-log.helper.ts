import { EventBus } from '@nestjs/cqrs';
import { ActionTypeEnum, ActorTypeEnum, BaseEntityEnum, IActivityLogUpdatedValues, ID } from '@gauzy/contracts';
import { ActivityLogEvent } from './events';

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
 * @description Create activity log for Action "Created"
 * @template T
 * @param {EventBus} eventBus - CQRS event to log activity
 * @param {BaseEntityEnum} entityType - Entity type for whom creating activity log (E.g : Task, OrganizationProject, etc.)
 * @param {string} entityName - Name or Title of created entity
 * @param {ActorTypeEnum} actor - The actor type performed action (User or System)
 * @param {ID} organizationId
 * @param {ID} tenantId
 * @param {T} data - Created entity data
 */
export function activityLogCreateAction<T>(
	eventBus: EventBus,
	entityType: BaseEntityEnum,
	entityName: string,
	actor: ActorTypeEnum,
	organizationId: ID,
	tenantId: ID,
	data: T
) {
	// Generate the activity log description
	const description = generateActivityLogDescription(ActionTypeEnum.Created, entityType, entityName);

	console.log(`Generating activity log description: ${description}`);

	// Emit an event to log the activity
	return eventBus.publish(
		new ActivityLogEvent({
			entity: entityType,
			entityId: data['id'],
			action: ActionTypeEnum.Created,
			actorType: actor,
			description,
			data,
			organizationId,
			tenantId
		})
	);
}

/**
 * @description Create Activity Log for Action "Updated"
 * @template T
 * @param {EventBus} eventBus - CQRS event to log activity
 * @param {BaseEntityEnum} entityType - Entity type for whom creating activity log (E.g : Task, OrganizationProject, etc.)
 * @param {string} entityName - Name or Title of created entity
 * @param {ActorTypeEnum} actor - The actor type performed action (User or System)
 * @param {ID} organizationId
 * @param {ID} tenantId
 * @param {Partial<T>} originalValues - entity data before update
 * @param {Partial<T>} newValues - entity updated data per field
 * @param {T} data - Updated entity data
= */
export function activityLogUpdateAction<T>(
	eventBus: EventBus,
	entityType: BaseEntityEnum,
	entityName: string,
	actor: ActorTypeEnum,
	organizationId: ID,
	tenantId: ID,
	originalValues: Partial<T>,
	newValues: Partial<T>,
	data: T
) {
	// Generate the activity log description
	const description = generateActivityLogDescription(ActionTypeEnum.Updated, entityType, entityName);

	// Retrieve updated fields, their old and new values
	const { updatedFields, previousValues, updatedValues } = activityLogUpdatedFieldsAndValues(
		originalValues,
		newValues
	);

	// Emit an event to log the activity
	return eventBus.publish(
		new ActivityLogEvent({
			entity: entityType,
			entityId: data['id'],
			action: ActionTypeEnum.Updated,
			actorType: actor,
			description,
			updatedFields,
			updatedValues,
			previousValues,
			data,
			organizationId,
			tenantId
		})
	);
}
