import { BadRequestException } from '@nestjs/common';
import { parseToBoolean } from '@gauzy/utils';
import { getSettingMetadata } from './system-setting.constants';

/**
 * Converts a setting value to its proper type based on metadata.
 */
export function convertSettingValue(value: string | undefined | null, key: string): any {
	if (value === undefined || value === null) return undefined;

	const metadata = getSettingMetadata(key);

	// Empty string handling: for number/boolean types, treat as invalid
	if (value === '') {
		if (metadata?.type === 'number' || metadata?.type === 'boolean') {
			throw new BadRequestException(`Setting "${key}" cannot be empty for type ${metadata.type}.`);
		}
		return '';
	}

	if (!metadata) return value;

	switch (metadata.type) {
		case 'boolean':
			return parseToBoolean(value);
		case 'number': {
			const num = Number(value);
			if (isNaN(num) || !isFinite(num)) {
				throw new BadRequestException(`Setting "${key}" must be a valid number.`);
			}
			return num;
		}
		default:
			return value;
	}
}
