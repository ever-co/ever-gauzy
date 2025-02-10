import { ValueTransformer } from 'typeorm';
import { UserNotificationTypeEnum } from '@gauzy/contracts';

/**
 * UserNotificationTypeTransformerPipe handles the conversion between the enum string values
 * (used in the application) and the integer values (stored in the database).
 */
export class UserNotificationTypeTransformerPipe implements ValueTransformer {
	/**
	 * Converts the enum string value to its integer representation when writing to the database.
	 *
	 * @param value - The `UserNotificationTypeEnum` value.
	 * @returns The corresponding integer value to be stored in the database.
	 */
	to(value: UserNotificationTypeEnum): number {
		switch (value) {
			case UserNotificationTypeEnum.PAYMENT:
				return 0;
			case UserNotificationTypeEnum.ASSIGNMENT:
				return 1;
			case UserNotificationTypeEnum.INVITATION:
				return 2;
			case UserNotificationTypeEnum.MENTION:
				return 3;
			case UserNotificationTypeEnum.COMMENT:
				return 4;
			case UserNotificationTypeEnum.MESSAGE:
				return 5;
			default:
				throw new Error(`Unknown notification type: ${value}`);
		}
	}

	/**
	 * Converts the integer value to its corresponding `UserNotificationTypeEnum` string when reading from the database.
	 *
	 * @param value - The integer value from the database.
	 * @returns The corresponding `UserNotificationTypeEnum`.
	 */
	from(value: number): UserNotificationTypeEnum {
		switch (value) {
			case 0:
				return UserNotificationTypeEnum.PAYMENT;
			case 1:
				return UserNotificationTypeEnum.ASSIGNMENT;
			case 2:
				return UserNotificationTypeEnum.INVITATION;
			case 3:
				return UserNotificationTypeEnum.MENTION;
			case 4:
				return UserNotificationTypeEnum.COMMENT;
			case 5:
				return UserNotificationTypeEnum.MESSAGE;
			default:
				throw new Error(`Unknown notification type value: ${value}`);
		}
	}
}
