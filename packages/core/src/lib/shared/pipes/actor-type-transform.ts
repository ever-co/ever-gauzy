import { ValueTransformer } from 'typeorm';
import { ActorTypeEnum } from '@gauzy/contracts';

/**
 * ActorTypeTransformer handles the conversion between the enum string values
 * (used in the application) and the integer values (stored in the database).
 *
 * `System` is 0 and `User` is 1 (unchanged since the column was introduced); `Agent` (an agent
 * employee, e.g. an Ever Works agent) is 2.
 */
export class ActorTypeTransformer implements ValueTransformer {
	/**
	 * Converts the enum string value to its integer representation when writing to the database.
	 *
	 * @param value - The `ActorTypeEnum` value ('System', 'User' or 'Agent').
	 * @returns The corresponding integer value to be stored in the database (0 for System, 1 for User,
	 * 2 for Agent). Any other value (including `undefined`) is stored as 0, as before.
	 */
	to(value: ActorTypeEnum): number {
		switch (value) {
			case ActorTypeEnum.User:
				return 1;
			case ActorTypeEnum.Agent:
				return 2;
			default:
				return 0; // 'System' (default)
		}
	}

	/**
	 * Converts the integer value to its corresponding `ActorTypeEnum` string when reading from the database.
	 *
	 * @param value - The integer value (0, 1 or 2) from the database.
	 * @returns The corresponding `ActorTypeEnum` ('System' for 0, 'User' for 1, 'Agent' for 2). Any other
	 * value (including `null`) reads as 'System', as before.
	 */
	from(value: number): ActorTypeEnum {
		switch (value) {
			case 1:
				return ActorTypeEnum.User;
			case 2:
				return ActorTypeEnum.Agent;
			default:
				return ActorTypeEnum.System;
		}
	}
}
