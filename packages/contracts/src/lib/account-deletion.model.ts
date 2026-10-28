import { IBaseEntityModel } from './base-entity.model';
import { LanguagesEnum } from './user.model';

/**
 * One "email me a link to delete my account" request.
 *
 * The emailed token is never stored: only its SHA-256 (`tokenHash`). The row outlives the deletion as the
 * audit record of the request, by then without the clear email address (`email` is cleared, `emailHash` stays).
 */
export interface IAccountDeletionRequest extends IBaseEntityModel {
	email?: string | null;
	emailHash: string;
	tokenHash: string;
	expiresAt: Date;
	/** When the link was claimed by a confirm (a lease: a claim older than a few minutes that never completed can be taken again). */
	usedAt?: Date | null;
	/** When the deletion finished. A completed request never works again. */
	completedAt?: Date | null;
	revokedAt?: Date | null;
	requestIpHash?: string | null;
	userAgent?: string | null;
	/** JSON of the app branding the link was requested with, reused for the "deleted" email. */
	branding?: string | null;
	/** JSON summary written when the deletion ran: counts only, no names or addresses. */
	result?: string | null;
}

/** Body of `POST /account-deletion/request`. */
export interface IAccountDeletionRequestInput {
	email: string;
	callbackUrl?: string;
	locale?: LanguagesEnum;
	appName?: string;
	appLogo?: string;
	appSignature?: string;
	appLink?: string;
	companyLink?: string;
	companyName?: string;
}

/** What happens to one account (one workspace) when the deletion is confirmed. */
export enum AccountDeletionOutcomeEnum {
	/** The user is the only user of the workspace: the whole workspace and its data are deleted. */
	WORKSPACE_DELETED = 'workspace-deleted',
	/** Other users share the workspace: the user's account is removed, the workspace stays. */
	ACCOUNT_REMOVED = 'account-removed'
}

/** One account (one workspace) listed on the confirmation page. */
export interface IAccountDeletionAccount {
	workspace: string;
	role?: string | null;
	organizations: string[];
	otherMembers: number;
	/** True when the user is the workspace's only admin and other members stay behind. */
	soleAdmin: boolean;
	outcome: AccountDeletionOutcomeEnum;
}

/** Response of `POST /account-deletion/verify` and `GET /account-deletion/me`. */
export interface IAccountDeletionPreview {
	/** The address the link was sent to, masked (`j***@example.com`). */
	email: string;
	/** When the link stops working; null for the signed-in preview (`GET /account-deletion/me`). */
	expiresAt: Date | null;
	accounts: IAccountDeletionAccount[];
	/**
	 * Fingerprint of the accounts and outcomes shown. The confirm sends it back; when what would be deleted has
	 * changed since (a member joined or left), the API answers 409 and deletes nothing.
	 */
	planHash: string;
}

/** Body of `POST /account-deletion/confirm`. */
export interface IAccountDeletionConfirmInput {
	token: string;
	confirm: true;
	planHash: string;
}

/** Body of `POST /account-deletion/me` (the branding fields brand the "deleted" email). */
export interface IAccountDeletionConfirmMeInput
	extends Pick<
		IAccountDeletionRequestInput,
		'appName' | 'appLogo' | 'appSignature' | 'appLink' | 'companyLink' | 'companyName'
	> {
	confirm: true;
	planHash: string;
}

/** Response of `POST /account-deletion/confirm` and `POST /account-deletion/me`. */
export interface IAccountDeletionResult {
	deleted: boolean;
	accounts: number;
	workspacesDeleted: number;
}
