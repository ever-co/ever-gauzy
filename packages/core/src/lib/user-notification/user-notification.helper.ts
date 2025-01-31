import { BaseEntityEnum, NotificationActionTypeEnum } from '@gauzy/contracts';

const UserNotificationTemplates = {
	[NotificationActionTypeEnum.Paid]: `You have been {action}`,
	[NotificationActionTypeEnum.Commented]: `{user} {action} on {entity} "{entityName}"`,
	[NotificationActionTypeEnum.Assigned]: `{user} {action} you to the {entity} "{entityName}"`,
	[NotificationActionTypeEnum.Invited]: `{user} {action} you to join the {entity} "{entityName}"`,
	[NotificationActionTypeEnum.Mentioned]: `{user} {action} you on {entity} "{entityName}"`,
	[NotificationActionTypeEnum.Messaged]: `{user} {action} you a new message"`
};

export function generateNotificationTitle(
	action: NotificationActionTypeEnum,
	entity: BaseEntityEnum,
	entityName: string,
	userName: string
) {
	// Get the template corresponding to the action
	const template = UserNotificationTemplates[action];

	// Replace placeholders in the template with actual values
	return template.replace(/\{(\w+)\}/g, (_, key) => {
		switch (key) {
			case 'action':
				return action;
			case 'entity':
				return entity;
			case 'entityName':
				return entityName;
			case 'userName':
				return userName;
			default:
				return '';
		}
	});
}
