import { IUser } from '@gauzy/contracts';

/**
 * Whether the user has proved they hold their CURRENT e-mail address.
 *
 * A user sets their own address through `PUT /user/:id` (an admin, any user's of their tenant), and the new address is
 * stored unconfirmed: `emailVerifiedAt` is cleared with it (UserService.moveToUnconfirmedAddress). A confirmation is
 * only recorded for an address its owner received mail at: the confirmation link or code, or an accepted invitation.
 * So anything found by the caller's address alone (the other accounts that share it, the invitations sent to it) is
 * theirs only once this holds; until then, anyone could type another person's address into a profile they control.
 *
 * @param user - The authenticated caller, as loaded for this request.
 * @returns Whether the caller's address is confirmed.
 */
export function holdsProvenAddress(user: Pick<IUser, 'emailVerifiedAt'> | null | undefined): boolean {
	return !!user?.emailVerifiedAt;
}
