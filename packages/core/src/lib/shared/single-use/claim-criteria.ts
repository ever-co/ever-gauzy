import { MoreThanOrEqual } from 'typeorm';
import { ID, InviteStatusEnum } from '@gauzy/contracts';

/**
 * WHERE clauses for the single-use token and code claims.
 *
 * These live apart from the services that use them because they ARE the security property. A
 * claim only enforces single use for as long as the value being consumed stays inside its own
 * WHERE clause — drop `code` from the email-verification criteria, or the `status` guard from the
 * invite criteria, and the statement still runs, still reports rows affected, and silently stops
 * being a claim at all. That is an easy thing to lose in an unrelated refactor and impossible to
 * notice by reading the call site.
 *
 * Keeping the predicates here, free of NestJS and entity imports, is what lets the regression
 * suite execute the REAL production criteria against a real database instead of a copy of them.
 * The services below must not inline these objects again.
 *
 * @see claim-criteria.spec.ts
 */

/**
 * Criteria for consuming a password-reset record, keyed on its primary key.
 *
 * Deleting by primary key is the claim: exactly one concurrent caller can remove a given row, so
 * the affected count picks the winner.
 */
export const passwordResetConsumeWhere = (id: ID) => ({ id });

/**
 * Criteria for claiming a magic sign-in code.
 *
 * `code` must stay in the clause — without it this degrades into "null the code for this email",
 * which every racing request would satisfy. One email can exist in several tenants, so a winning
 * claim may legitimately cover more than one row.
 */
export const magicCodeClaimWhere = (email: string, code: string) => ({ email, code });

/**
 * Criteria for claiming an email-verification code (TypeORM).
 *
 * `code` makes it single-use; `codeExpireAt` closes the window where the lookup and the claim
 * straddle the expiry boundary and an expired code is accepted; `tenantId` comes from the verified
 * payload because this runs on a public endpoint with no request context to scope by.
 */
export const emailVerificationClaimWhere = (id: ID, code: string, tenantId: ID, now: Date) => ({
	id,
	code,
	tenantId,
	codeExpireAt: MoreThanOrEqual(now)
});

/**
 * Criteria for claiming an email-verification code (MikroORM).
 *
 * Identical in meaning to {@link emailVerificationClaimWhere}; written separately because a
 * TypeORM operator object would not survive `nativeUpdate`, which speaks its own query syntax.
 */
export const emailVerificationClaimWhereMikroOrm = (id: ID, code: string, tenantId: ID, now: Date) => ({
	id,
	code,
	tenantId,
	codeExpireAt: { $gte: now }
});

/**
 * Criteria for claiming an invite for acceptance.
 *
 * The expected prior status is the guard: `INVITED -> ACCEPTED` can only be won once, which is
 * what stops two concurrent acceptances from each running a full registration.
 */
export const inviteClaimWhere = (id: ID) => ({ id, status: InviteStatusEnum.INVITED });

/**
 * Criteria for releasing a claimed invite after acceptance failed part-way.
 *
 * Scoped to ACCEPTED so a release cannot resurrect an invite that was rejected or expired by some
 * other path in the meantime.
 */
export const inviteReleaseWhere = (id: ID) => ({ id, status: InviteStatusEnum.ACCEPTED });
