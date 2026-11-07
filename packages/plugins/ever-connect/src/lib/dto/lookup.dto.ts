import { BadRequestException } from '@nestjs/common';
import { CONSTANTS } from '../sdk';

/** The identifier kinds a contact can be checked by. */
export const LOOKUP_ITEM_KINDS = Object.freeze(['vat', 'registration', 'email'] as const);
export type LookupItemKind = (typeof LOOKUP_ITEM_KINDS)[number];

/** The longest value taken (an e-mail address is at most 320 characters). */
export const LOOKUP_MAX_VALUE_LENGTH = 320;

/** At most this many identifiers per check (Ever Platform takes at most 100 hashes per query). */
export const LOOKUP_MAX_ITEMS: number =
	(CONSTANTS as { lookup?: { max_hashes_per_query?: number } }).lookup?.max_hashes_per_query ?? 100;

/** One identifier of a contact to check. The value never leaves this installation. */
export interface LookupItem {
	kind: LookupItemKind;
	value: string;
	/** Two letters (ISO 3166-1): the country a VAT number without its prefix, or a registration number, belongs to. */
	country?: string | null;
}

/** `POST /api/ever-connect/lookup?organizationId=`: `{ "items": [{ "kind", "value", "country"? }] }`. */
export interface LookupRequest {
	items: LookupItem[];
}

/** What a check found for one identifier, in the order of the request. Never the value, never a hash. */
export interface LookupItemResult {
	kind: LookupItemKind;
	/**
	 * `match`: an organization that chose to be discoverable has this identifier; `none`: no
	 * discoverable organization was found (which says nothing about whether it uses Ever Platform);
	 * `cannot_be_checked`: the value cannot be normalised (`reason`), so it was not sent.
	 */
	status: 'match' | 'none' | 'cannot_be_checked';
	/** `cannot_be_checked`: `empty`, `no_country`, `no_at_sign` or `bad_domain`. */
	reason?: string;
	/** `match`: the organization's handle (its page is `ever.co/<handle>`). */
	handle?: string;
	/** `match`: what the organization offers on Ever Platform (`pay`, `invoice_exchange`, `listings`). */
	features?: string[];
}

export interface LookupResponse {
	items: LookupItemResult[];
}

/** `PUT /api/ever-connect/integrations/counterparty_lookup/options`: `{ "auto_check": true|false }`. */
export interface LookupOptionsRequest {
	auto_check: boolean;
}

const COUNTRY = /^[A-Za-z]{2}$/;

/**
 * The checked request, or 400. The messages name the field and the rule only, never a value.
 */
export function parseLookupRequest(body: unknown): LookupRequest {
	const items = (body as { items?: unknown } | null)?.items;
	if (!Array.isArray(items) || items.length === 0) {
		throw new BadRequestException('items must be a non-empty list.');
	}
	if (items.length > LOOKUP_MAX_ITEMS) {
		throw new BadRequestException(`items holds at most ${LOOKUP_MAX_ITEMS} identifiers.`);
	}
	const out: LookupItem[] = [];
	items.forEach((raw, index) => {
		const item = raw as Partial<Record<'kind' | 'value' | 'country', unknown>> | null;
		if (!item || typeof item !== 'object' || Array.isArray(item)) {
			throw new BadRequestException(`items[${index}] must be an object.`);
		}
		const extra = Object.keys(item).filter((key) => !['kind', 'value', 'country'].includes(key));
		if (extra.length) {
			throw new BadRequestException(`items[${index}] has an unknown field.`);
		}
		if (typeof item.kind !== 'string' || !(LOOKUP_ITEM_KINDS as ReadonlyArray<string>).includes(item.kind)) {
			throw new BadRequestException(`items[${index}].kind must be vat, registration or email.`);
		}
		if (typeof item.value !== 'string' || item.value.length > LOOKUP_MAX_VALUE_LENGTH) {
			throw new BadRequestException(
				`items[${index}].value must be text of at most ${LOOKUP_MAX_VALUE_LENGTH} characters.`
			);
		}
		const country = item.country;
		if (country !== undefined && country !== null && country !== '') {
			if (typeof country !== 'string' || !COUNTRY.test(country.trim())) {
				throw new BadRequestException(`items[${index}].country must be two letters.`);
			}
		}
		out.push({
			kind: item.kind as LookupItemKind,
			value: item.value,
			country: typeof country === 'string' && country.trim() ? country.trim().toUpperCase() : null
		});
	});
	return { items: out };
}

/** The checked options request, or 400. */
export function parseLookupOptions(body: unknown): LookupOptionsRequest {
	const autoCheck = (body as { auto_check?: unknown } | null)?.auto_check;
	if (typeof autoCheck !== 'boolean') {
		throw new BadRequestException('auto_check must be true or false.');
	}
	return { auto_check: autoCheck };
}
