import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

/**
 * The organization segment of an uploaded document's storage key (`documents/<tenantId>/<organizationId>/`).
 *
 * It used to be the raw `Organization-Id` header, so a caller could file their bytes under the key prefix of any
 * organization they named. It is now the organization the request is scoped to: the token's, which `JwtStrategy`
 * has already held to the caller's active memberships (`RequestContext.currentOrganizationId()`). The header never
 * names the folder. A request without a token organization gets the random fallback segment, which names no
 * organization (as a request without the header always did); the document row still records the organization the
 * validated upload names.
 *
 * A header that is sent but is not a UUID is refused (400) before any byte is stored, as the AI chat attachments
 * refuse it (ever-co/ever-gauzy#11358). So is a header sent with several values, whatever they are: checking one of
 * them would let any other value through.
 *
 * @param contextOrganizationId The organization of the request (`RequestContext.currentOrganizationId()`).
 * @param header The raw `Organization-Id` header, only checked for its format.
 * @param fallback The segment used when the request has no organization.
 * @returns A path-safe organization segment.
 * @throws BadRequestException when the `Organization-Id` header is sent with several values, or is not a UUID.
 */
export function documentStorageOrganizationSegment(
	contextOrganizationId: string | null | undefined,
	header: string | string[] | undefined,
	fallback: () => string
): string {
	if (Array.isArray(header) && header.length > 1) {
		throw new BadRequestException('The `Organization-Id` header must be sent once.');
	}
	const headerValue = Array.isArray(header) ? header[0] : header;
	if (headerValue && !isUUID(String(headerValue))) {
		throw new BadRequestException('The `Organization-Id` header must be a UUID.');
	}

	// Path-sanitize: ids are UUIDs, but a key segment is never trusted verbatim.
	const organizationId = String(contextOrganizationId || '').replace(/[^a-zA-Z0-9-]/g, '');
	return organizationId || fallback();
}
