import { ValueTransformer } from 'typeorm';
import { EmployeeNotificationTypeEnum } from '@gauzy/contracts';

/**
 * EmployeeNotificationTypeTransformer handles the conversion between the enum string values
 * (used in the application) and the integer values (stored in the database).
 */
export class EmployeeNotificationTypeTransformer implements ValueTransformer {
	/**
	 * Converts the enum string value to its integer representation when writing to the database.
	 *
	 * @param value - The `EmployeeNotificationTypeEnum` value.
	 * @returns The corresponding integer value to be stored in the database.
	 */
	to(value: EmployeeNotificationTypeEnum): number {
		switch (value) {
			case EmployeeNotificationTypeEnum.PAYMENT:
				return 0;
			case EmployeeNotificationTypeEnum.ASSIGNMENT:
				return 1;
			case EmployeeNotificationTypeEnum.INVITATION:
				return 2;
			case EmployeeNotificationTypeEnum.MENTION:
				return 3;
			case EmployeeNotificationTypeEnum.COMMENT:
				return 4;
			case EmployeeNotificationTypeEnum.MESSAGE:
				return 5;
			default:
				throw new Error(`Unknown notification type: ${value}`);
		}
	}

	/**
	 * Converts the integer value to its corresponding `EmployeeNotificationTypeEnum` string when reading from the database.
	 *
	 * @param value - The integer value from the database.
	 * @returns The corresponding `EmployeeNotificationTypeEnum`.
	 */
	from(value: number): EmployeeNotificationTypeEnum {
		switch (value) {
			case 0:
				return EmployeeNotificationTypeEnum.PAYMENT;
			case 1:
				return EmployeeNotificationTypeEnum.ASSIGNMENT;
			case 2:
				return EmployeeNotificationTypeEnum.INVITATION;
			case 3:
				return EmployeeNotificationTypeEnum.MENTION;
			case 4:
				return EmployeeNotificationTypeEnum.COMMENT;
			case 5:
				return EmployeeNotificationTypeEnum.MESSAGE;
			default:
				throw new Error(`Unknown notification type value: ${value}`);
		}
	}
}
