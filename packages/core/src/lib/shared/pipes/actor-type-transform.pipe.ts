import { ValueTransformer } from 'typeorm';
import { ActorTypeEnum } from '@gauzy/contracts';

/**
 * ActorTypeTransformerPipe handles the conversion between the enum string values
 * (used in the application) and the integer values (stored in the database).
 */
export class ActorTypeTransformerPipe implements ValueTransformer {
	/**
	 * Converts the enum string value to its integer representation when writing to the database.
	 *
	 * @param value - The `ActorTypeEnum` value ('System' or 'User').
	 * @returns The corresponding integer value to be stored in the database (0 for System, 1 for User).
	 */
	to(value: ActorTypeEnum): number {
		return value === ActorTypeEnum.User ? 1 : 0; // 1 for 'User', 0 for 'System' (default)
	}

	/**
	 * Converts the integer value to its corresponding `ActorTypeEnum` string when reading from the database.
	 *
	 * @param value - The integer value (0 or 1) from the database.
	 * @returns The corresponding `ActorTypeEnum` ('System' for 0, 'User' for 1).
	 */
	from(value: number): ActorTypeEnum {
		return value === 1 ? ActorTypeEnum.User : ActorTypeEnum.System;
	}
}
