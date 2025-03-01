import { BaseEntityEnum, NotificationActionTypeEnum } from '@gauzy/contracts';

const EmployeeNotificationTemplates = {
	[NotificationActionTypeEnum.Paid]: `You have been {action}`,
	[NotificationActionTypeEnum.Commented]: `{employeeName} {action} on {entity} "{entityName}"`,
	[NotificationActionTypeEnum.Assigned]: `{employeeName} {action} you to the {entity} "{entityName}"`,
	[NotificationActionTypeEnum.Invited]: `{employeeName} {action} you to join the {entity} "{entityName}"`,
	[NotificationActionTypeEnum.Mentioned]: `{employeeName} {action} you on the {entity} "{entityName}"`,
	[NotificationActionTypeEnum.Messaged]: `{employeeName} sent you a new message"`
};

/**
 * Generates a notification title by replacing placeholders in a predefined template.
 *
 * This function retrieves a template corresponding to the provided notification action
 * from the `EmployeeNotificationTemplates` object. It then replaces any placeholder in the template,
 * formatted as `{placeholder}`, with the actual values provided via the function parameters.
 *
 * The supported placeholders are:
 * - `{action}`: Will be replaced with the `action` parameter, indicating the notification type.
 * - `{entity}`: Will be replaced with the `entity` parameter, indicating the type of entity associated with the notification.
 * - `{entityName}`: Will be replaced with the `entityName` parameter, providing context about the specific entity.
 * - `{employeeName}`: Will be replaced with the `employeeName` parameter, specifying the employee related to the notification.
 *
 * @param {NotificationActionTypeEnum} action - The type of notification action triggering the title (e.g., 'Paid', 'Assigned').
 * @param {BaseEntityEnum} entity - The entity type associated with the notification (e.g., 'Task', 'Employee').
 * @param {string} entityName - The human-readable name of the entity, providing context in the title.
 * @param {string} employeeName - The name of the employee involved in the action, to personalize the notification.
 * @returns {string} The generated notification title with all placeholders replaced by their corresponding values.
 */
export function generateNotificationTitle(
	action: NotificationActionTypeEnum,
	entity: BaseEntityEnum,
	entityName: string,
	employeeName: string
): string {
	// Retrieve the template corresponding to the notification action
	const template = EmployeeNotificationTemplates[action];

	// Replace placeholders in the template with actual values
	return template.replace(/\{(\w+)\}/g, (_, key) => {
		switch (key) {
			case 'action':
				return action;
			case 'entity':
				return entity;
			case 'entityName':
				return entityName;
			case 'employeeName':
				return employeeName;
			default:
				return '';
		}
	});
}
