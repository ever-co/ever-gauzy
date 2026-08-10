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

/** Number of trailing characters left visible so an operator can still tell two credentials apart. */
const SECRET_HINT_LENGTH = 4;

/**
 * Masks a secret value, leaving only a short trailing hint visible.
 *
 * The previous implementation starred a percentage of the value from each end and left everything
 * between them in cleartext — at 25% that returned roughly half of a 40-character OAuth token
 * verbatim. It also used non-global `String.replace`, so a suffix that occurred earlier in the value
 * was masked instead of the real tail. Both are fixed here by masking the whole value up front
 * (GHSA-3rqg-gpm9-gx84).
 *
 * @param value - The sensitive value to mask.
 * @param character - The character used for replacement.
 * @returns The masked value: all but the last few characters replaced.
 */
export function maskSecret(value: unknown, character = '*'): string {
	const secret = String(value ?? '');
	const visible = secret.length <= SECRET_HINT_LENGTH ? 0 : SECRET_HINT_LENGTH;
	return character.repeat(Math.max(secret.length - visible, 0)) + secret.slice(secret.length - visible);
}

/**
 * Wrap specified keys in an object with a specific character based on metadata.
 *
 * @param secrets - The object containing the sensitive data.
 * @param targets - The target class or classes with metadata.
 * @param percentage - Retained for backward compatibility; masking is no longer partial.
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
						secrets[key] = maskSecret(value, character);
					}
				}
			}
		}
	}
	return secrets;
}
