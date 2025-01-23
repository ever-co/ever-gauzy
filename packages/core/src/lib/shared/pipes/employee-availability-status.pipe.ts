import { ValueTransformer } from 'typeorm';
import { AvailabilityStatusEnum } from '@gauzy/contracts';

/**
 * Transformer to handle the conversion between the enum values
 * (used in the application) and integer values (stored in the database).
 */
export class AvailabilityStatusTransformer implements ValueTransformer {
	/**
	 * Converts the enum value to its corresponding integer representation
	 * when saving to the database.
	 *
	 * @param value - The `AvailabilityStatusEnum` value.
	 * @returns The corresponding integer value for storage in the database.
	 */
	to(value: AvailabilityStatusEnum): number {
		switch (value) {
			case AvailabilityStatusEnum.Available:
				return 0;
			case AvailabilityStatusEnum.Partial:
				return 1;
			case AvailabilityStatusEnum.Unavailable:
				return 2;
			default:
				return null;
		}
	}

	/**
	 * Converts the integer value from the database back to the corresponding
	 * enum value when reading.
	 *
	 * @param value - The integer value stored in the database.
	 * @returns The corresponding `AvailabilityStatusEnum` value.
	 */
	from(value: number): AvailabilityStatusEnum {
		switch (value) {
			case 0:
				return AvailabilityStatusEnum.Available;
			case 1:
				return AvailabilityStatusEnum.Partial;
			case 2:
				return AvailabilityStatusEnum.Unavailable;
			default:
				return null;
		}
	}
}
