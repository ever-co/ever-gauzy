import { ForbiddenException } from '@nestjs/common';
import { RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import {
	callerRoleRank,
	keepsTrackingSwitch,
	mayActAsTeamManager,
	mayTurnTrackingOf,
	rankInTeam,
	rankOfRole,
	TrackingSwitchRank
} from './tracking-switch-rule';

/**
 * Who may turn someone's time tracking on or off (ever-co/ever-teams#5015): only someone of a higher role, and an
 * admin also for another admin. SUPER_ADMIN and ADMIN rank the same, MANAGER below them, every other role below that.
 */
describe('tracking switch rule', () => {
	const { ADMIN, MANAGER, MEMBER } = TrackingSwitchRank;

	describe('rankOfRole', () => {
		it.each(
			[
				{ roleName: RolesEnum.SUPER_ADMIN, rank: ADMIN },
				{ roleName: RolesEnum.ADMIN, rank: ADMIN },
				{ roleName: RolesEnum.MANAGER, rank: MANAGER },
				{ roleName: RolesEnum.EMPLOYEE, rank: MEMBER },
				{ roleName: RolesEnum.DATA_ENTRY, rank: MEMBER },
				{ roleName: RolesEnum.VIEWER, rank: MEMBER },
				{ roleName: RolesEnum.CANDIDATE, rank: MEMBER },
				{ roleName: RolesEnum.INTERVIEWER, rank: MEMBER },
				{ roleName: undefined, rank: MEMBER },
				{ roleName: null, rank: MEMBER }
			].map((row) => ({ ...row, rankName: TrackingSwitchRank[row.rank] }))
		)('ranks $roleName as $rankName', ({ roleName, rank }) => {
			expect(rankOfRole(roleName)).toBe(rank);
		});
	});

	describe('rankInTeam', () => {
		it('raises a member who manages the team to manager', () => {
			expect(rankInTeam(MEMBER, true)).toBe(MANAGER);
		});

		it('never lowers a rank, and leaves a member who does not manage the team a member', () => {
			expect(rankInTeam(ADMIN, true)).toBe(ADMIN);
			expect(rankInTeam(ADMIN, false)).toBe(ADMIN);
			expect(rankInTeam(MANAGER, false)).toBe(MANAGER);
			expect(rankInTeam(MEMBER, false)).toBe(MEMBER);
		});
	});

	describe('mayTurnTrackingOf', () => {
		it.each([
			{ who: 'an admin', whom: 'another admin, or themselves', actor: ADMIN, target: ADMIN, allowed: true },
			{ who: 'an admin', whom: 'a manager', actor: ADMIN, target: MANAGER, allowed: true },
			{ who: 'an admin', whom: 'a member', actor: ADMIN, target: MEMBER, allowed: true },
			{ who: 'a manager', whom: 'a member', actor: MANAGER, target: MEMBER, allowed: true },
			{
				who: 'a manager',
				whom: 'another manager, or themselves',
				actor: MANAGER,
				target: MANAGER,
				allowed: false
			},
			{ who: 'a manager', whom: 'an admin', actor: MANAGER, target: ADMIN, allowed: false },
			{ who: 'a member', whom: 'another member, or themselves', actor: MEMBER, target: MEMBER, allowed: false },
			{ who: 'a member', whom: 'a manager', actor: MEMBER, target: MANAGER, allowed: false },
			{ who: 'a member', whom: 'an admin', actor: MEMBER, target: ADMIN, allowed: false }
		])('$who acting on $whom: $allowed', ({ actor, target, allowed }) => {
			expect(mayTurnTrackingOf(actor, target)).toBe(allowed);
		});
	});

	describe('keepsTrackingSwitch', () => {
		it('refuses with a 403 a change the rule does not allow', () => {
			expect(() => keepsTrackingSwitch(MANAGER, MANAGER, true)).toThrow(ForbiddenException);
			expect(() => keepsTrackingSwitch(MEMBER, MEMBER, true)).toThrow(ForbiddenException);
		});

		it('writes the switch of someone the caller may switch, changed or not', () => {
			expect(keepsTrackingSwitch(MANAGER, MEMBER, true)).toBe(true);
			expect(keepsTrackingSwitch(MANAGER, MEMBER, false)).toBe(true);
			expect(keepsTrackingSwitch(ADMIN, ADMIN, false)).toBe(true);
		});

		it('leaves out a switch sent back unchanged by a caller who may not switch it, so it cannot overwrite a change', () => {
			expect(keepsTrackingSwitch(MANAGER, MANAGER, false)).toBe(false);
			expect(keepsTrackingSwitch(MEMBER, ADMIN, false)).toBe(false);
		});
	});

	describe('callerRoleRank', () => {
		afterEach(() => jest.restoreAllMocks());

		const asCaller = (role: unknown, extra: Record<string, unknown> = {}) =>
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1', role, ...extra } as never);

		it.each(
			[
				{ name: RolesEnum.SUPER_ADMIN, rank: ADMIN },
				{ name: RolesEnum.ADMIN, rank: ADMIN },
				{ name: RolesEnum.MANAGER, rank: MANAGER },
				{ name: RolesEnum.EMPLOYEE, rank: MEMBER }
			].map((row) => ({ ...row, rankName: TrackingSwitchRank[row.rank] }))
		)('ranks a caller holding $name as $rankName', ({ name, rank }) => {
			asCaller({ name });

			expect(callerRoleRank()).toBe(rank);
		});

		it('ranks a caller with no known role as a member', () => {
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue(null);

			expect(callerRoleRank()).toBe(MEMBER);
		});

		it('never ranks a third-party OAuth app token above a member, whatever role its user holds', () => {
			jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue([]);
			asCaller({ name: RolesEnum.ADMIN });

			expect(callerRoleRank()).toBe(MEMBER);
		});
	});

	describe('mayActAsTeamManager', () => {
		afterEach(() => jest.restoreAllMocks());

		it('lets a first-party caller act with the rank of a team its user manages', () => {
			jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(null);

			expect(mayActAsTeamManager()).toBe(true);
		});

		it('never lets a third-party OAuth app token act as a team manager, whatever scopes were approved', () => {
			jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(['zap:write']);
			expect(mayActAsTeamManager()).toBe(false);

			jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue([]);
			expect(mayActAsTeamManager()).toBe(false);
		});
	});
});
