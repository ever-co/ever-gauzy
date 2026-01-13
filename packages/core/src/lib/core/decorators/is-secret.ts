import { isClassInstance, isNotEmpty, isObject } from '@gauzy/utils';

/**
 * Checks if value is needs to be wrap with specific character.
 *
 * @param boolean
 * @returns
 */
export function IsSecret(boolean: boolean = true): PropertyDecorator {
	return (target, property) => {
		Reflect.defineMetadata(property, boolean, target);
	};
}

/**
 * Masks a string by replacing characters at the start and end with a mask character.
 * Uses character index-based replacement to avoid issues with substring matching.
 *
 * @param value - The string value to mask.
 * @param percentage - The percentage of the string to mask at start and end (default 35%).
 * @param character - The character to use for masking (default '*').
 * @returns The masked string.
 */
export function maskSecretValue(value: string, percentage = 35, character = '*'): string {
	if (!value || typeof value !== 'string') {
		return value;
	}

	const length = value.length;

	// For very short strings (less than 4 chars), mask entirely
	if (length < 4) {
		return character.repeat(length);
	}

	// Calculate the number of characters to mask at each end
	const maskLength = Math.ceil((percentage / 100) * length);

	// Ensure we don't mask the entire string - leave at least 1 character visible in the middle
	// If maskLength * 2 >= length, adjust to leave some middle characters visible
	const maxMaskPerSide = Math.floor((length - 1) / 2);
	const effectiveMaskLength = Math.min(maskLength, maxMaskPerSide);

	// If even with adjustment we can't show any middle characters, mask entirely
	if (effectiveMaskLength <= 0) {
		return character.repeat(length);
	}

	// Convert string to array for character-by-character manipulation
	const chars = value.split('');

	// Mask characters at the start
	for (let i = 0; i < effectiveMaskLength; i++) {
		chars[i] = character;
	}

	// Mask characters at the end
	for (let i = length - effectiveMaskLength; i < length; i++) {
		chars[i] = character;
	}

	return chars.join('');
}

/**
 * Wrap specified keys in an object with a specific character based on metadata.
 * Uses index-based character replacement to properly mask secrets without
 * issues from substring matching or overlapping segments.
 *
 * @param secrets - The object containing the sensitive data.
 * @param targets - The target class or classes with metadata.
 * @param percentage - The percentage of the string to be replaced with the character.
 * @param character - The character used for replacement.
 * @returns The object with specified keys wrapped.
 */
export function WrapSecrets(secrets: Record<string, any>, targets: any | any[], percentage = 35, character = '*') {
	// Check if found class target, convert it into array to use for loop
	if (isClassInstance(targets)) {
		targets = [targets];
	}
	for (const target of targets) {
		if (isObject(secrets)) {
			for (const [key, value] of Object.entries(secrets)) {
				if (Reflect.hasMetadata(key, target) && Reflect.getMetadata(key, target)) {
					if (isNotEmpty(value)) {
						const string = value.toString();
						secrets[key] = maskSecretValue(string, percentage, character);
					}
				}
			}
		}
	}
	return secrets;
}
