import { buildMessage, isUUID, ValidateBy, ValidationOptions } from 'class-validator';

/**
 * Checks that a value is a role reference in OBJECT form: a plain object whose `id` is a UUID.
 *
 * @param value The value to check.
 * @returns True for `{ id: '<uuid>', ... }`, false for anything else (a bare id string included).
 */
export function isRoleReference(value: unknown): boolean {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return false;
	}
	return isUUID((value as { id?: unknown }).id);
}

/**
 * Accepts a `role` relation only as an object carrying a UUID `id` (extra fields, such as a full role
 * record the client loaded, are allowed; only the `id` is persisted).
 *
 * A bare id STRING used to pass validation (`IsRoleShouldExist` accepts one) and reach the services,
 * whose role checks read `role?.id` and so saw nothing, while TypeORM wrote the string as the foreign
 * key (GHSA-x4mv-fhwj-g3rp). The services now read every form themselves; this refuses the string form
 * at the edge as well. Clients send the flat `roleId` for a bare id.
 *
 * @param validationOptions - Validation options.
 * @returns {PropertyDecorator} - Decorator function.
 */
export const IsRoleReference = (validationOptions?: ValidationOptions): PropertyDecorator =>
	ValidateBy(
		{
			name: 'isRoleReference',
			validator: {
				validate: (value): boolean => isRoleReference(value),
				defaultMessage: buildMessage(
					(eachPrefix) => eachPrefix + '$property must be an object with a UUID id',
					validationOptions
				)
			}
		},
		validationOptions
	);
