import { createHash } from 'crypto';

/**
 * How a gift card's second factor is stored: the lowercase hexadecimal SHA-256 digest of the PIN as it was stated.
 *
 * One function, used by every write that stores a PIN and by the comparison that checks one
 * (`GiftCardService.balanceByCode`), so the stored form and the checked form cannot drift apart again. They did
 * (review R2-G30): `POST /gift-cards` and `PUT /gift-cards/:id` stored the PIN of the body verbatim while the check
 * compared the digest of the presented PIN with the column, so a card issued over REST with a PIN never verified, and
 * the PIN sat in the table in plaintext. The PIN is hashed as stated, without trimming or case folding, because the
 * check hashes the presented value exactly so.
 *
 * @param pin The PIN as the caller stated it.
 * @returns Its digest, 64 lowercase hexadecimal characters.
 */
export function hashGiftCardPin(pin: string): string {
	return createHash('sha256').update(String(pin)).digest('hex');
}

/**
 * Whether a stored `gift_card.pin` value is already a digest in the form {@link hashGiftCardPin} writes (64
 * hexadecimal characters, either case, since the comparison reads the hex case-insensitively).
 *
 * The data migration `HashGiftCardPins1791000000785` uses it to tell a plaintext PIN from a digest. A plaintext PIN
 * that is itself 64 hexadecimal characters is indistinguishable from a digest and is left as it is.
 *
 * @param value The stored value.
 * @returns True when the value is a digest.
 */
export function isGiftCardPinDigest(value: unknown): boolean {
	return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value);
}

/**
 * The `gift_card.pin` value a write stores for a PIN a caller stated.
 *
 * - absent (`undefined`): nothing to write, the stored value is left alone;
 * - `null` or an empty string: the card carries no second factor (`null`) - an empty value never was one, since the
 *   check treats a falsy column as "no PIN";
 * - anything else: its digest.
 *
 * @param pin The PIN as the caller stated it.
 * @returns The value to store, or `undefined` when nothing is to be written.
 */
export function storedGiftCardPin(pin: unknown): string | null | undefined {
	if (pin === undefined) {
		return undefined;
	}

	if (pin === null || pin === '') {
		return null;
	}

	return hashGiftCardPin(String(pin));
}
