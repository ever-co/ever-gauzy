import { BaseEntityEnum, NotificationActionTypeEnum } from '@gauzy/contracts';

const UserNotificationTemplates = {
	[NotificationActionTypeEnum.Paid]: `You have been {action}`,
	[NotificationActionTypeEnum.Commented]: `{userName} {action} on {entity} "{entityName}"`,
	[NotificationActionTypeEnum.Assigned]: `{userName} {action} you to the {entity} "{entityName}"`,
	[NotificationActionTypeEnum.Invited]: `{userName} {action} you to join the {entity} "{entityName}"`,
	[NotificationActionTypeEnum.Mentioned]: `{userName} {action} you on the {entity} "{entityName}"`,
	[NotificationActionTypeEnum.Messaged]: `{userName} {action} you a new message"`
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
