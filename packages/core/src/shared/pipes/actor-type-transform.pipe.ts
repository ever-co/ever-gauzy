import { Logger } from '@nestjs/common';
import { ValueTransformer } from 'typeorm';
import { ActorTypeEnum } from '@gauzy/contracts';

/**
 * ActorTypeTransformerPipe handles the conversion between the enum string values
 * (used in the application) and the integer values (stored in the database).
 */
export class ActorTypeTransformerPipe implements ValueTransformer {
	private readonly logger = new Logger(ActorTypeTransformerPipe.name);

	/**
	 * Converts the enum string value to its integer representation when writing to the database.
	 *
	 * @param value - The `ActorTypeEnum` value ('System' or 'User').
	 * @returns The corresponding integer value to be stored in the database (0 for System, 1 for User).
	 */
	to(value: ActorTypeEnum): number {
		this.logger.debug(`ActorTypeTransformerPipe: converting ${value} to integer`);
		return value === ActorTypeEnum.User ? 1 : 0; // 1 for 'User', 0 for 'System' (default)
	}

	/**
	 * Converts the integer value to its corresponding `ActorTypeEnum` string when reading from the database.
	 *
	 * @param value - The integer value (0 or 1) from the database.
	 * @returns The corresponding `ActorTypeEnum` ('System' for 0, 'User' for 1).
	 */
	from(value: number): ActorTypeEnum {
		this.logger.debug(`ActorTypeTransformerPipe: converting ${value} to enum`);
		return value === 1 ? ActorTypeEnum.User : ActorTypeEnum.System;
	}
}
