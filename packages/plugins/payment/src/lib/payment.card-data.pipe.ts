import { ArgumentMetadata, BadRequestException, HttpStatus, Injectable, PipeTransform, UsePipes } from '@nestjs/common';
import { findCardDataField } from './payment.validators';

/**
 * The code a body that carries card data is refused with.
 *
 * The catalogue home of this value is `06-api-specification.md` §6.8, and the rule it carries is the
 * one the stored-instrument tables exist to make unnecessary: the platform stores a reference the
 * provider issued and holds no primary account number, no verification value, no full bank account
 * number and no track or chip data. The value is stated here as a literal rather than read from the
 * kernel's `ApiErrorCode` map because that map — which this package may not edit — does not carry it,
 * and the plugin already answers with it from the inbound-callback intake, so both places spell the
 * code the specification publishes.
 */
export const PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED = 'PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED';

/**
 * Refuses a request body that carries card data, naming the member it carried it in.
 *
 * **Why this is a pipe and not a DTO member.** The whitelisting pipe is what makes "no member outside
 * the contract is written" true, but a member the contract does not declare is stripped — or refused
 * with the generic validation envelope — before any DTO code could look at it. A caller that sends a
 * card number has to be told *which* member the platform cannot receive and *why*, in the code the
 * catalogue publishes, because the alternative (a body that validates and quietly loses the number,
 * or a message about an unknown property) reads as a bug in the caller's client rather than as the
 * platform's own rule. So the refusal happens before the contract pipe, on the raw body, and it is a
 * **validation failure**: the request never reaches the provider adapter and never reaches a table.
 *
 * The walk is recursive, so `{ payment: { card: { number } } }` is refused exactly as `{ number }` is,
 * and it reads member *names*, never values — a refused body is still a body, and the refusal must not
 * copy a credential into a log line or an error payload.
 *
 * **Declaration order matters.** Nest's pipes are applied in the order they are declared and method
 * decorators are collected bottom-up, so this one has to sit *below* `@UseValidationPipe(...)` on a
 * route to run before it. `payment-method-token.controller.spec.ts` asserts the resulting order, so a
 * later reordering fails a test rather than silently answering with a different code.
 */
@Injectable()
export class RejectCardDataPipe implements PipeTransform {
	/**
	 * @param value The raw value Nest extracted from the request.
	 * @param metadata What the value was extracted from: only a request body is inspected.
	 * @returns The value, untouched, when the body carries no card data.
	 * @throws BadRequestException `400 PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED`, with `details.field`
	 * naming the member and the message stating that the field has to be collected by the provider.
	 */
	transform(value: unknown, metadata: ArgumentMetadata): unknown {
		// A query string or a path parameter is not a body, and refusing a filter that happens to be
		// spelled `expiry` would refuse a read for a rule about writes.
		if (metadata?.type !== 'body') {
			return value;
		}

		const member = findCardDataField(value);

		if (!member) {
			return value;
		}

		throw new BadRequestException({
			statusCode: HttpStatus.BAD_REQUEST,
			code: PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED,
			message:
				`${PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED}: card data is not accepted. The platform stores a ` +
				`provider-issued token only; the field '${member}' must be collected by the provider.`,
			details: { field: member }
		});
	}
}

/**
 * Applies {@link RejectCardDataPipe} to the route or controller it decorates.
 *
 * A decorator rather than a bare `@UsePipes(new RejectCardDataPipe())` at each route, because the
 * pipe must also be reachable from the pattern's whitelist on a route that reads a body — writing it
 * once keeps the code, the message and the member name in one place.
 *
 * @returns The method/class decorator that installs the pipe.
 */
export function UseCardDataRefusal(): MethodDecorator & ClassDecorator {
	return UsePipes(new RejectCardDataPipe());
}
