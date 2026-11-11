/**
 * `POST /auth/workspaces` (ever-co/ever-teams#5025): a signed-in person opens another workspace without signing out
 * of the one they are in.
 */
import { IsNull } from 'typeorm';
import type { User } from '../core/entities/internal';

/** The answer: the account the new workspace is created with, as a workspace sign-in. */
export interface IWorkspaceOpening {
	/** The account's address: the caller's own. */
	email: string;
	/** A workspace sign-in token for that account, exchanged at `POST /auth/signin.workspace`. */
	token: string;
}

/** Why a caller whose address is not proven cannot open a workspace: they would not even see it among theirs. */
export const WORKSPACE_ADDRESS_UNPROVEN_MESSAGE = 'Confirm your email address before opening another workspace';

/**
 * Why an opening was refused where the sign-up has a paywall: the address holds no entitlement to the product. A new
 * workspace is a new tenant, which the paywall is there for (the register route's SubscriptionRequiredGuard).
 */
export const WORKSPACE_SUBSCRIPTION_REQUIRED_MESSAGE =
	'A subscription is required before you can open another workspace. ' +
	'Choose a plan to start your free trial, then try again.';

/** Why an opening was refused: another one for the same address holds its lock (MySQL, after 10 seconds). */
export const WORKSPACE_OPENING_IN_PROGRESS_MESSAGE = 'Another workspace is being opened for this address';

/**
 * The accounts of an address an opening reads and writes, on the transaction that holds the address's lock (see
 * `AuthService.withWorkspaceOpeningLock`).
 */
export interface WorkspaceAccounts {
	/** The address's most recent active account with no tenant and no password: one an earlier attempt left. */
	findUnfinished(email: string): Promise<User | null>;
	/** A new account for the caller's address (see {@link workspaceAccountFieldsOf}), its address proven as theirs is. */
	create(caller: User): Promise<User>;
	/** Marks the account's address proven: the column is left out of inserts, so it is written apart. */
	proveAddress(account: User, provenAt: Date): Promise<void>;
}

/** The accounts of `email` an earlier opening left without a workspace: active, no tenant, no password. */
export function unfinishedAccountWhere(email: string) {
	return { email, tenantId: IsNull(), hash: IsNull(), isActive: true, isArchived: false };
}

/**
 * The account a new workspace of the caller is created with: their address, name, picture, time zone and language;
 * no tenant, no role and no password.
 */
export function workspaceAccountFieldsOf(caller: User) {
	return {
		email: caller.email,
		firstName: caller.firstName,
		lastName: caller.lastName,
		imageUrl: caller.imageUrl,
		timeZone: caller.timeZone,
		preferredLanguage: caller.preferredLanguage,
		isActive: true,
		isArchived: false
	};
}
