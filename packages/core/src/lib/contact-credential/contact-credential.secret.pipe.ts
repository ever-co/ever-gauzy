import { ArgumentMetadata, BadRequestException, HttpStatus, Injectable, PipeTransform, UsePipes } from '@nestjs/common';
import { ApiErrorCode } from '../core/errors/api-error-codes';

/**
 * The members a credential body may never carry, each with the operation that owns it.
 *
 * The four secrets are the row's own: the hash is produced by the platform's password hasher, the
 * authenticator secret is enrolled by the flow that verifies a factor, and the two single-use tokens
 * exist as hashes whose plaintext exists only in the message that carried it. `plainPassword` is here
 * beside them because it is the spelling a caller reaches for when it believes it is handing the
 * platform a password to store — which is the one thing this table exists not to do.
 *
 * `password` itself is deliberately absent: a registration route takes the credential's own password
 * and hashes it with the platform's hasher before the service is reached, exactly as the platform's
 * staff-registration path does. What may never cross the boundary is a *hash*, or an argument that
 * claims to be one.
 */
export const CREDENTIAL_SECRET_MEMBERS: readonly string[] = [
	'passwordHash',
	'plainPassword',
	'mfaSecret',
	'verificationToken',
	'resetToken'
];

/**
 * Finds the first member of a body that carries a credential secret, reading member **names** only.
 *
 * The walk is recursive, so `{ metadata: { passwordHash } }` is refused exactly as `{ passwordHash }`
 * is, and it never reads a value: a refused body is still a body, and a refusal must not copy a
 * credential into a log line or an error payload.
 *
 * @param value The body as it arrived.
 * @param path The path reached so far, for the member name the refusal reports.
 * @returns The dotted path of the offending member, or null when the body carries none.
 */
export function findCredentialSecret(value: unknown, path = ''): string | null {
	if (!value || typeof value !== 'object') {
		return null;
	}

	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index++) {
			const found = findCredentialSecret(value[index], `${path}[${index}]`);

			if (found) {
				return found;
			}
		}

		return null;
	}

	for (const [member, nested] of Object.entries(value as Record<string, unknown>)) {
		const here = path ? `${path}.${member}` : member;

		if (CREDENTIAL_SECRET_MEMBERS.includes(member)) {
			return here;
		}

		const found = findCredentialSecret(nested, here);

		if (found) {
			return found;
		}
	}

	return null;
}

/**
 * Refuses a request body that carries a credential secret, naming the member it carried it in.
 *
 * **Why this is a pipe and not a DTO member.** The whitelisting pipe already makes "no member outside
 * the contract is written" true, but a member the contract does not declare is either stripped or
 * refused with the generic validation envelope before any DTO code could look at it. A caller that
 * sends a password hash has to be told *which* member the platform cannot receive and *why*, in the
 * code the catalogue publishes, because the alternative — a body that validates and quietly loses the
 * hash, or a message about an unknown property — reads as a bug in the caller's client rather than as
 * the platform's own rule. So the refusal happens before the contract pipe, on the raw body, and it is
 * a **validation failure**: the request never reaches the service and never reaches a table.
 *
 * The refusal is the contact domain's own code rather than a generic one:
 * `CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED` is what the service raises for the same member, so a client
 * that branches on the code over one path branches on it over the other.
 *
 * **Declaration order matters.** Nest's pipes are applied in the order they are declared and method
 * decorators are collected bottom-up, so this one has to sit *below* `@UseValidationPipe(...)` on a
 * route to run before it — the same rule the payment package's card-data refusal follows, and the same
 * assertion its suite makes about the resulting order.
 */
@Injectable()
export class RejectCredentialSecretPipe implements PipeTransform {
	/**
	 * @param value The raw value Nest extracted from the request.
	 * @param metadata What the value was extracted from: only a request body is inspected.
	 * @returns The value, untouched, when the body carries no secret member.
	 * @throws BadRequestException `400 CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED`, with `details.field`
	 * naming the member and the message stating which operation owns it.
	 */
	transform(value: unknown, metadata: ArgumentMetadata): unknown {
		// A query string or a path parameter is not a body, and refusing a filter that happens to be
		// spelled `email` would refuse a read for a rule about writes.
		if (metadata?.type !== 'body') {
			return value;
		}

		const member = findCredentialSecret(value);

		if (!member) {
			return value;
		}

		throw new BadRequestException({
			statusCode: HttpStatus.BAD_REQUEST,
			code: ApiErrorCode.CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED,
			message:
				`${ApiErrorCode.CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED}: '${member}' is a secret the platform ` +
				'produces and never a value a request states; the operation that observes it owns it.',
			details: { field: member }
		});
	}
}

/**
 * Applies {@link RejectCredentialSecretPipe} to the route or controller it decorates.
 *
 * A decorator rather than a bare `@UsePipes(new RejectCredentialSecretPipe())` at each route, because
 * the pipe has to be reachable from the pattern's whitelist on a route that reads a body — writing it
 * once keeps the code, the message and the member list in one place.
 *
 * @returns The method/class decorator that installs the pipe.
 */
export function UseCredentialSecretRefusal(): MethodDecorator & ClassDecorator {
	return UsePipes(new RejectCredentialSecretPipe());
}
