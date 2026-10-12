/**
 * Helpers for writes that change a user's e-mail address.
 *
 * `emailVerifiedAt` records that the user received mail at `user.email`. Once `user.email` names a
 * different mailbox, that record is about an address the account no longer holds, so every path
 * that changes the address must reset it. Several flows rely on the column as proof of receipt —
 * linking a billing customer that was matched by address, the e-mail confirmation endpoints, and
 * other checks that only trust a confirmed address — and a carried-over confirmation would let an
 * account that switched to someone else's address pass them without ever reading that mailbox.
 */

/**
 * The form two addresses are compared in: trimmed and case-folded. Mail providers treat the address
 * case-insensitively in practice, so re-saving the same address in a different case (or with stray
 * whitespace) is not a change of mailbox and must keep the existing confirmation.
 */
export function normalizeEmailAddress(email: string | null | undefined): string {
	return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * Whether a write that carries `requested` moves the account to a different mailbox than `current`.
 *
 * `undefined` means the write does not touch the address at all.
 */
export function isEmailAddressChange(current: string | null | undefined, requested: string | null | undefined): boolean {
	if (requested === undefined) {
		return false;
	}
	return normalizeEmailAddress(current) !== normalizeEmailAddress(requested);
}

/**
 * The columns to write together with a new, NOT yet confirmed address.
 *
 * Besides the confirmation itself, any outstanding confirmation link or code was delivered to the
 * previous address; left in place it could be redeemed for the new address (the code endpoint looks
 * the account up by the address the caller names). A fresh link and code are issued for the new
 * address by the confirmation e-mail.
 */
export const UNCONFIRMED_EMAIL_STATE = Object.freeze({
	emailVerifiedAt: null,
	emailToken: null,
	code: null,
	codeExpireAt: null
});
