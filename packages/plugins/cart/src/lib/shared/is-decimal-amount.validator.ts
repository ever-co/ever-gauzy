import { ValidationOptions, registerDecorator } from 'class-validator';
import { DecimalString } from '@gauzy/contracts';
import { isValidDecimalString, normalizeDecimalString } from '@gauzy/core';

/**
 * A money value as a request may state it.
 *
 * Both forms are accepted deliberately. The GraphQL surface declares money as `Decimal`, whose own
 * definition in `common.type.gql` promises that "a money value read here and the same value read over
 * REST are string-identical"; the REST DTOs declared the same fields `@IsNumber() number`, so the two
 * surfaces described two different wire formats for one field and a client generated from the OpenAPI
 * document could not share a money type with a client generated from the SDL. Widening REST to accept
 * the exact decimal string the schema promises settles that without breaking the numeric clients that
 * exist today.
 */
export type DecimalAmount = DecimalString | number;

/**
 * Whether a value is a money amount the platform can carry exactly.
 *
 * A string must be an exact decimal — `DECIMAL_STRING_PATTERN`, at most fourteen integer digits and
 * twelve fractional ones. A number must be finite and must survive being read as a decimal: a double
 * past the safe-integer range renders as `1.2345678901234568e+21`, which is not a decimal at all, and
 * accepting it would store an amount nobody stated.
 *
 * @param value The value a request stated.
 * @returns True when it is a money amount.
 */
export function isDecimalAmount(value: unknown): value is DecimalAmount {
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) {
			return false;
		}

		try {
			return isValidDecimalString(normalizeDecimalString(value));
		} catch {
			return false;
		}
	}

	return typeof value === 'string' && isValidDecimalString(value.trim());
}

/**
 * Accepts a money amount stated either as an exact decimal string or as a number.
 *
 * It replaces `@IsNumber()` on the money members of this package's DTOs rather than sitting beside it:
 * `@IsNumber()` refuses the string form the GraphQL schema promises, and it accepts a `number` no
 * money column can hold — `unitPrice: 1234567890.123456` passed validation and was stored as
 * `1234567890.1234560`, a different amount, with nothing anywhere reporting the loss.
 *
 * @param validationOptions The usual class-validator options.
 * @returns The property decorator.
 */
export function IsDecimalAmount(validationOptions?: ValidationOptions): PropertyDecorator {
	return function (object: object, propertyName: string | symbol): void {
		registerDecorator({
			name: 'isDecimalAmount',
			target: object.constructor,
			propertyName: propertyName as string,
			options: validationOptions,
			validator: {
				validate(value: unknown): boolean {
					return isDecimalAmount(value);
				},
				defaultMessage(): string {
					return (
						`$property must be a money amount: an exact decimal string such as "19.990000", or a ` +
						'number a decimal can hold exactly.'
					);
				}
			}
		});
	};
}
