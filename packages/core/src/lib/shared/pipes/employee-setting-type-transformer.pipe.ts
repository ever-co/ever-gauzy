import { ValueTransformer } from 'typeorm';
import { EmployeeSettingTypeEnum } from '@gauzy/contracts';

/**
 * EmployeeSettingTypeTransformerPipe handles the conversion between the enum string values
 * (used in the application) and the integer values (stored in the database).
 */
export class EmployeeSettingTypeTransformerPipe implements ValueTransformer {
	/**
	 * Converts the enum string value to its integer representation when writing to the database.
	 *
	 * @param value - The `EmployeeSettingTypeEnum` value ('Normal', 'Task-View', 'Custom').
	 * @returns The corresponding integer value to be stored in the database.
	 */
	to(value: EmployeeSettingTypeEnum): number {
		switch (value) {
			case EmployeeSettingTypeEnum.TASK_VIEWS:
				return 1;
			case EmployeeSettingTypeEnum.CUSTOM:
				return 2;
			default:
				return 0; // Default is NORMAL
		}
	}

	/**
	 * Converts the integer value to its corresponding `EmployeeSettingTypeEnum` string when reading from the database.
	 *
	 * @param value - The integer value (0, 1, or 2) from the database.
	 * @returns The corresponding `EmployeeSettingTypeEnum` ('Normal', 'Task-View', 'Custom').
	 */
	from(value: number): EmployeeSettingTypeEnum {
		switch (value) {
			case 1:
				return EmployeeSettingTypeEnum.TASK_VIEWS;
			case 2:
				return EmployeeSettingTypeEnum.CUSTOM;
			default:
				return EmployeeSettingTypeEnum.NORMAL;
		}
	}
}
