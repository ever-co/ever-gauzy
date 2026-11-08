import { DocumentShareAccessEnum, DocumentVisibilityEnum } from '@gauzy/contracts';
import {
	IDocumentAccessRow,
	IDocumentAccessSubject,
	canAdministerShares,
	effectiveShareAccess,
	hasShareAtLeast,
	isDocumentLockedFor,
	isDocumentReadable,
	isDocumentWritable,
	isTeamSpaceMember,
	shareTargetsSubject
} from './document-access.predicate';

const CREATOR = 'user-creator';
const OTHER = 'user-other';
const EMPLOYEE = 'employee-other';
const TEAM = 'team-alpha';

/** A document row factory with the PRIVATE default the truth table is about. */
const doc = (overrides: Partial<IDocumentAccessRow> = {}): IDocumentAccessRow => ({
	createdByUserId: CREATOR,
	visibility: DocumentVisibilityEnum.PRIVATE,
	shares: [],
	...overrides
});

/** A subject factory: a plain `DOCS_READ` holder who is not the creator. */
const subject = (overrides: Partial<IDocumentAccessSubject> = {}): IDocumentAccessSubject => ({
	userId: OTHER,
	employeeId: EMPLOYEE,
	teamIds: [],
	hasReadPermission: true,
	hasManagePermission: false,
	hasUpdatePermission: false,
	...overrides
});

describe('document access predicate — visibility + share composition (spec 08 §3)', () => {
	describe('§3.4 effective read-access truth table', () => {
		it('row 1: no DOCS_READ ⇒ not readable, whatever else holds', () => {
			const noRead = subject({ hasReadPermission: false, hasManagePermission: true, userId: CREATOR });

			// ORGANIZATION, creator, admin, and an EDIT share — none of them substitute for the permission.
			expect(isDocumentReadable(doc({ visibility: DocumentVisibilityEnum.ORGANIZATION }), noRead)).toBe(false);
			expect(isDocumentReadable(doc(), noRead)).toBe(false);
			expect(
				isDocumentReadable(
					doc({ shares: [{ employeeId: EMPLOYEE, access: DocumentShareAccessEnum.EDIT }] }),
					noRead
				)
			).toBe(false);
		});

		it('row 2: ORGANIZATION documents are readable by any DOCS_READ holder', () => {
			expect(isDocumentReadable(doc({ visibility: DocumentVisibilityEnum.ORGANIZATION }), subject())).toBe(true);
		});

		it('row 3: the creator reads their own PRIVATE document', () => {
			expect(isDocumentReadable(doc(), subject({ userId: CREATOR }))).toBe(true);
		});

		it('row 4: DOCS_MANAGE reads any PRIVATE document', () => {
			expect(isDocumentReadable(doc(), subject({ hasManagePermission: true }))).toBe(true);
		});

		it('row 5: a VIEW share makes a PRIVATE document readable', () => {
			const shared = doc({ shares: [{ employeeId: EMPLOYEE, access: DocumentShareAccessEnum.VIEW }] });
			expect(isDocumentReadable(shared, subject())).toBe(true);
		});

		it('row 5: a TEAM share resolves through current membership', () => {
			const shared = doc({ shares: [{ teamId: TEAM, access: DocumentShareAccessEnum.VIEW }] });

			expect(isDocumentReadable(shared, subject({ teamIds: [TEAM] }))).toBe(true);
			// Removed from the team ⇒ access is gone on the very next evaluation.
			expect(isDocumentReadable(shared, subject({ teamIds: [] }))).toBe(false);
		});

		it('row 6: a PRIVATE document with no ownership, no admin and no share is not readable', () => {
			expect(isDocumentReadable(doc(), subject())).toBe(false);
		});
	});

	describe('share targeting', () => {
		it('matches an employee grant only for that employee', () => {
			const share = { employeeId: EMPLOYEE, access: DocumentShareAccessEnum.VIEW };

			expect(shareTargetsSubject(share, subject())).toBe(true);
			expect(shareTargetsSubject(share, subject({ employeeId: 'someone-else' }))).toBe(false);
		});

		it('never matches a subject without an employee identity', () => {
			const share = { employeeId: EMPLOYEE, access: DocumentShareAccessEnum.VIEW };
			expect(shareTargetsSubject(share, subject({ employeeId: null }))).toBe(false);
		});

		it('takes the STRONGEST applicable grant when several apply', () => {
			const shared = doc({
				shares: [
					{ employeeId: EMPLOYEE, access: DocumentShareAccessEnum.VIEW },
					{ teamId: TEAM, access: DocumentShareAccessEnum.EDIT }
				]
			});
			expect(effectiveShareAccess(shared, subject({ teamIds: [TEAM] }))).toBe(DocumentShareAccessEnum.EDIT);
		});

		it('ranks EDIT ≥ COMMENT ≥ VIEW', () => {
			const commentShare = doc({ shares: [{ employeeId: EMPLOYEE, access: DocumentShareAccessEnum.COMMENT }] });

			expect(hasShareAtLeast(commentShare, subject(), DocumentShareAccessEnum.VIEW)).toBe(true);
			expect(hasShareAtLeast(commentShare, subject(), DocumentShareAccessEnum.COMMENT)).toBe(true);
			expect(hasShareAtLeast(commentShare, subject(), DocumentShareAccessEnum.EDIT)).toBe(false);
		});

		it('has NO effect on ORGANIZATION documents (v1 rule)', () => {
			const shared = doc({
				visibility: DocumentVisibilityEnum.ORGANIZATION,
				shares: [{ employeeId: EMPLOYEE, access: DocumentShareAccessEnum.EDIT }]
			});
			expect(effectiveShareAccess(shared, subject())).toBeNull();
		});
	});

	describe('write access = readable AND verb AND (owner OR admin OR EDIT share)', () => {
		it('an EDIT share without DOCS_UPDATE grants no write', () => {
			const shared = doc({ shares: [{ employeeId: EMPLOYEE, access: DocumentShareAccessEnum.EDIT }] });

			expect(isDocumentReadable(shared, subject())).toBe(true);
			expect(isDocumentWritable(shared, subject())).toBe(false);
		});

		it('an EDIT share with DOCS_UPDATE grants write', () => {
			const shared = doc({ shares: [{ employeeId: EMPLOYEE, access: DocumentShareAccessEnum.EDIT }] });
			expect(isDocumentWritable(shared, subject({ hasUpdatePermission: true }))).toBe(true);
		});

		it('a COMMENT share never grants write', () => {
			const shared = doc({ shares: [{ employeeId: EMPLOYEE, access: DocumentShareAccessEnum.COMMENT }] });
			expect(isDocumentWritable(shared, subject({ hasUpdatePermission: true }))).toBe(false);
		});

		it('the creator writes their own document when they hold DOCS_UPDATE, not otherwise', () => {
			expect(isDocumentWritable(doc(), subject({ userId: CREATOR, hasUpdatePermission: true }))).toBe(true);
			expect(isDocumentWritable(doc(), subject({ userId: CREATOR, hasUpdatePermission: false }))).toBe(false);
		});

		it('DOCS_MANAGE bypasses ownership but not the verb permission', () => {
			expect(
				isDocumentWritable(doc(), subject({ hasManagePermission: true, hasUpdatePermission: true }))
			).toBe(true);
			expect(
				isDocumentWritable(doc(), subject({ hasManagePermission: true, hasUpdatePermission: false }))
			).toBe(false);
		});
	});

	describe('lock semantics (423, not 403)', () => {
		it('blocks a non-owner and bypasses for the owner and for DOCS_MANAGE', () => {
			const locked = doc({ isLocked: true });

			expect(isDocumentLockedFor(locked, subject())).toBe(true);
			expect(isDocumentLockedFor(locked, subject({ userId: CREATOR }))).toBe(false);
			expect(isDocumentLockedFor(locked, subject({ hasManagePermission: true }))).toBe(false);
		});

		it('an unlocked document never blocks anyone', () => {
			expect(isDocumentLockedFor(doc({ isLocked: false }), subject())).toBe(false);
		});
	});

	describe('team spaces (TEAM visibility reads like PRIVATE shared with the team at EDIT)', () => {
		const teamDoc = doc({ visibility: DocumentVisibilityEnum.TEAM, organizationTeamId: TEAM });

		it('row 5: a current member of the team reads and writes the page', () => {
			expect(isTeamSpaceMember(teamDoc, subject({ teamIds: [TEAM] }))).toBe(true);
			expect(isDocumentReadable(teamDoc, subject({ teamIds: [TEAM] }))).toBe(true);
			expect(isDocumentWritable(teamDoc, subject({ teamIds: [TEAM], hasUpdatePermission: true }))).toBe(true);
			// The verb permission is still needed on top.
			expect(isDocumentWritable(teamDoc, subject({ teamIds: [TEAM] }))).toBe(false);
		});

		it('row 7: someone outside the team sees nothing, unless shared or an admin', () => {
			expect(isDocumentReadable(teamDoc, subject({ teamIds: ['team-other'] }))).toBe(false);
			expect(isDocumentReadable(teamDoc, subject({ hasManagePermission: true }))).toBe(true);
			expect(isDocumentReadable(teamDoc, subject({ userId: CREATOR }))).toBe(true);
			const shared = doc({ visibility: DocumentVisibilityEnum.TEAM, organizationTeamId: TEAM, shares: [{ employeeId: EMPLOYEE, access: DocumentShareAccessEnum.VIEW }] });
			expect(isDocumentReadable(shared, subject())).toBe(true);
			expect(effectiveShareAccess(shared, subject())).toBe(DocumentShareAccessEnum.VIEW);
		});

		it("a TEAM page without a team (its team deleted) is the creator's and the admins' only", () => {
			const orphan = doc({ visibility: DocumentVisibilityEnum.TEAM, organizationTeamId: null });
			expect(isTeamSpaceMember(orphan, subject({ teamIds: [TEAM] }))).toBe(false);
			expect(isDocumentReadable(orphan, subject({ teamIds: [TEAM] }))).toBe(false);
			expect(isDocumentReadable(orphan, subject({ userId: CREATOR }))).toBe(true);
		});

		it('ORGANIZATION pages ignore team membership and shares as before', () => {
			const open = doc({ visibility: DocumentVisibilityEnum.ORGANIZATION });
			expect(isTeamSpaceMember(open, subject({ teamIds: [TEAM] }))).toBe(false);
			expect(effectiveShareAccess(doc({ visibility: DocumentVisibilityEnum.ORGANIZATION, shares: [{ employeeId: EMPLOYEE, access: DocumentShareAccessEnum.EDIT }] }), subject())).toBeNull();
		});
	});

	describe('share administration (creator or DOCS_MANAGE only)', () => {
		it('allows the creator and DOCS_MANAGE holders', () => {
			expect(canAdministerShares(doc(), subject({ userId: CREATOR }))).toBe(true);
			expect(canAdministerShares(doc(), subject({ hasManagePermission: true }))).toBe(true);
		});

		it('refuses an EDIT grantee — a share can never be re-shared', () => {
			const shared = doc({ shares: [{ employeeId: EMPLOYEE, access: DocumentShareAccessEnum.EDIT }] });
			expect(canAdministerShares(shared, subject({ hasUpdatePermission: true }))).toBe(false);
		});
	});
});
