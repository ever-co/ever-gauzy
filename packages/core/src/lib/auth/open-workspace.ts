/**
 * `POST /auth/workspaces` (ever-co/ever-teams#5025): a signed-in person opens another workspace without signing out
 * of the one they are in.
 */

/** The answer: the account the new workspace is created with, as a workspace sign-in. */
export interface IWorkspaceOpening {
	/** The account's address: the caller's own. */
	email: string;
	/** A workspace sign-in token for that account, exchanged at `POST /auth/signin.workspace`. */
	token: string;
}

/** Why a caller whose address is not proven cannot open a workspace: they would not even see it among theirs. */
export const WORKSPACE_ADDRESS_UNPROVEN_MESSAGE = 'Confirm your email address before opening another workspace';
