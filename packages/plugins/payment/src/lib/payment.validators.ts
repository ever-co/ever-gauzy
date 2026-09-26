import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/** Shape a monetary operand must have: an exact decimal, never an exponent and never a float literal. */
const DECIMAL_PATTERN = /^[+-]?\d{1,14}(\.\d{1,6})?$/;

/**
 * Accepts a value that is an exact decimal.
 *
 * Money is an exact decimal, never a binary floating point number: `0.1`, `24.99` and `0.15` have no
 * exact double representation, and the representation error becomes observable the moment a total is
 * rounded and stored. A request may therefore carry the decimal either as a string (`"24.99"`, the
 * form the API documents) or as a JSON number that is exactly representable within the storage scale;
 * anything else — `NaN`, `Infinity`, an exponent, more than six fractional digits — is rejected here
 * rather than silently rounded later.
 *
 * @param validationOptions Standard class-validator options.
 * @returns The property decorator.
 */
export function IsDecimalAmount(validationOptions?: ValidationOptions): PropertyDecorator {
	return (object: object, propertyName: string) => {
		registerDecorator({
			name: 'isDecimalAmount',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			validator: {
				validate(value: unknown): boolean {
					if (typeof value === 'string') {
						return DECIMAL_PATTERN.test(value.trim());
					}

					if (typeof value === 'number') {
						return Number.isFinite(value) && DECIMAL_PATTERN.test(String(value));
					}

					return false;
				},
				defaultMessage(args: ValidationArguments): string {
					return `${args.property} must be an exact decimal amount with at most six fractional digits`;
				}
			}
		});
	};
}

/**
 * Member names that carry card data.
 *
 * The platform stores a provider-issued token and no primary account number, no verification value,
 * no full bank account number and no track or chip data, so a body that carries one of these is
 * refused — as a validation failure, never as a silent drop, so a caller that tries to send a card
 * number learns immediately that this platform cannot receive one. No column, DTO or input type in
 * this package has a member of any of these names; the check is what turns an attempt into the
 * documented refusal.
 */
export const CARD_DATA_FIELDS: readonly string[] = [
	'number',
	'cardnumber',
	'pan',
	'cvc',
	'cvv',
	'cvv2',
	'iban',
	'accountnumber',
	'expiry',
	'expirydate',
	'expirationdate'
];

/**
 * The value of this member is masked in an error message, because a refused body is still a body.
 */
const REDACTED_MEMBERS: readonly string[] = ['token', 'signature'];

/**
 * Normalises a member name so that `card_number`, `cardNumber` and `card-number` are one name.
 *
 * @param key The member name to normalise.
 * @returns The name without separators, lower case.
 */
function normaliseKey(key: string): string {
	return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

/**
 * Finds the first member of a request body that carries card data.
 *
 * The walk is recursive because a nested object is still a request body: `{ payment: { card: { number } } }`
 * is the same attempt as `{ number }`, and a check that only read the top level would let it through.
 *
 * @param payload The value to inspect, typically a request body.
 * @param path The path of `payload` inside the body, used in the returned name.
 * @returns The offending member path, or `null` when the body carries no card data.
 */
export function findCardDataField(payload: unknown, path = ''): string | null {
	if (payload === null || payload === undefined) {
		return null;
	}

	if (Array.isArray(payload)) {
		for (let index = 0; index < payload.length; index++) {
			const found = findCardDataField(payload[index], `${path}[${index}]`);

			if (found) {
				return found;
			}
		}

		return null;
	}

	if (typeof payload !== 'object') {
		return null;
	}

	for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
		const where = path ? `${path}.${key}` : key;

		if (CARD_DATA_FIELDS.includes(normaliseKey(key))) {
			return where;
		}

		if (value !== null && typeof value === 'object') {
			const found = findCardDataField(value, where);

			if (found) {
				return found;
			}
		}
	}

	return null;
}

/**
 * Member names that hold a credential rather than a setting.
 *
 * A provider registration carries non-secret configuration only: credentials live in the
 * `integration_setting` rows of the integration the registration points at, where they are wrapped,
 * excluded from serialization and rotated in one place. A configuration that carried `apiKey` would
 * be a second, unmanaged copy of a credential — readable by every role that may read a provider and
 * written to every log line that prints one — so the write is refused instead.
 */
const SECRET_KEYS: readonly string[] = [
	'secret',
	'apikey',
	'apisecret',
	'password',
	'token',
	'accesstoken',
	'refreshtoken',
	'clientsecret',
	'secretkey',
	'signingsecret',
	'webhooksecret',
	'privatekey',
	'privateapikey',
	'publishablesecret',
	'credential',
	'credentials'
];

/**
 * Finds the first member of a configuration object whose name marks it as a credential.
 *
 * @param payload The configuration to inspect, however deeply nested.
 * @param path The path of `payload` inside the configuration, used in the returned name.
 * @returns The offending member path, or `null` when the configuration holds no credential.
 */
export function findSecretConfigurationKey(payload: unknown, path = ''): string | null {
	if (payload === null || payload === undefined || typeof payload !== 'object') {
		return null;
	}

	if (Array.isArray(payload)) {
		for (let index = 0; index < payload.length; index++) {
			const found = findSecretConfigurationKey(payload[index], `${path}[${index}]`);

			if (found) {
				return found;
			}
		}

		return null;
	}

	for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
		const where = path ? `${path}.${key}` : key;

		if (SECRET_KEYS.includes(normaliseKey(key))) {
			return where;
		}

		if (value !== null && typeof value === 'object') {
			const found = findSecretConfigurationKey(value, where);

			if (found) {
				return found;
			}
		}
	}

	return null;
}

/**
 * Describes a refused member without reproducing its value.
 *
 * @param member The member path that was refused.
 * @param value The value that was refused.
 * @returns A sentence naming the member and, for a value that is not a credential itself, the value.
 */
export function describeRefusedMember(member: string, value: unknown): string {
	const name = member.split('.').pop() ?? member;

	if (REDACTED_MEMBERS.includes(normaliseKey(name))) {
		return `'${member}' is not accepted here.`;
	}

	return `'${member}' is not accepted here (received ${JSON.stringify(value)}).`;
}
