import { isClassInstance, isNotEmpty, isObject } from "@gauzy/common";

/**
 * Checks if value is needs to be wrap with specific character.
 *  
 * @param boolean 
 * @returns 
 */
export function IsSecret(boolean: boolean = true): PropertyDecorator {
    return (target, property) => {
		Reflect.defineMetadata(
			property,
			boolean,
			target
		);
    }
}

/**
 * Wrapper for secrets keys
 * 
 * @param secrets 
 * @param target 
 * @param offset 
 * @param character 
 * @returns 
 */
export function WrapSecrets(secrets: any, targets : any, offset = 6, character = '*') {
	// Check if found class target, convert it into array to use for loop
	if (isClassInstance(targets)) {
		targets = [targets];
	}
	for (const target of targets) {
		if (isObject(secrets)) {
			for (const [key, value] of Object.entries(secrets)) {
				if (Reflect.hasMetadata(key, target)) {
					if (Reflect.getMetadata(key, target)) {
						if (isNotEmpty(value)) {
							const string = value.toString();
							// Get first offset character
							const first = string.substring(0, offset);
							// Get last offset character
							const last = string.slice(string.length - offset);
							// Create character repeater
							const repeater = character.repeat(offset);
							// ReplaceAll secrets with character
							secrets[key] = string.replace(first, repeater).replace(last, repeater);
						}
					}
				}
			}
		}
	}
	return secrets;
}