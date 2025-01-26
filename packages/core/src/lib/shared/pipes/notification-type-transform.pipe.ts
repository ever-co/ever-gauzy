import { ValueTransformer } from 'typeorm';
import { NotificationTypeEnum } from '@gauzy/contracts';

/**
 * NotificationTypeTransformerPipe handles the conversion between the enum string values
 * (used in the application) and the integer values (stored in the database).
 */
export class NotificationTypeTransformerPipe implements ValueTransformer {
	/**
	 * Converts the enum string value to its integer representation when writing to the database.
	 *
	 * @param value - The `NotificationTypeEnum` value.
	 * @returns The corresponding integer value to be stored in the database.
	 */
	to(value: NotificationTypeEnum): number {
		switch (value) {
			case NotificationTypeEnum.PAYMENT:
				return 0;
			case NotificationTypeEnum.ASSIGNEMENT:
				return 1;
			case NotificationTypeEnum.INVITATION:
				return 2;
			case NotificationTypeEnum.MENTION:
				return 3;
			case NotificationTypeEnum.COMMENT:
				return 4;
			case NotificationTypeEnum.MESSAGE:
				return 5;
			default:
				throw new Error(`Unknown notification type: ${value}`);
		}
	}

	/**
	 * Converts the integer value to its corresponding `NotificationTypeEnum` string when reading from the database.
	 *
	 * @param value - The integer value from the database.
	 * @returns The corresponding `NotificationTypeEnum`.
	 */
	from(value: number): NotificationTypeEnum {
		switch (value) {
			case 0:
				return NotificationTypeEnum.PAYMENT;
			case 1:
				return NotificationTypeEnum.ASSIGNEMENT;
			case 2:
				return NotificationTypeEnum.INVITATION;
			case 3:
				return NotificationTypeEnum.MENTION;
			case 4:
				return NotificationTypeEnum.COMMENT;
			case 5:
				return NotificationTypeEnum.MESSAGE;
			default:
				throw new Error(`Unknown notification type value: ${value}`);
		}
	}
}
