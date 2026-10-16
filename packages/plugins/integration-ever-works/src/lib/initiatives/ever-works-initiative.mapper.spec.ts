/**
 * G-P2-2 Missions ↔ Strategic Initiatives: the pure mappers (plan 01 §9) — status both ways (Gauzy only
 * ever finishes a mission, never activates it), leadership and drafts, the Ever Works side of an
 * initiative, the push plan and the create body.
 */
import {
	OrganizationStrategicPerceivedMomentumEnum as Momentum,
	OrganizationStrategicStateEnum as State
} from '@gauzy/contracts';
import {
	everWorksMissionShared,
	gauzyInitiativeOf,
	gauzyInitiativeShared,
	initiativeEligibility,
	initiativeStateToMission,
	missionCreateBody,
	missionPushPlan,
	missionStatusToInitiative,
	sameTitle
} from './ever-works-initiative.mapper';

describe('mission ↔ initiative status', () => {
	it('EW → G: active → active; paused → active + stalled; completed / failed → resolved with the outcome', () => {
		expect(missionStatusToInitiative('active')).toEqual({ state: State.ACTIVE, perceivedMomentum: null });
		expect(missionStatusToInitiative('paused')).toEqual({
			state: State.ACTIVE,
			perceivedMomentum: Momentum.STALLED
		});
		expect(missionStatusToInitiative('completed', 'partially_succeeded')).toEqual({
			state: State.RESOLVED,
			outcome: 'partially_succeeded'
		});
		expect(missionStatusToInitiative('failed')).toEqual({ state: State.RESOLVED, outcome: 'failed' });
		expect(missionStatusToInitiative('something-new')).toBeNull();
	});

	it('G → EW: only finishing is pushed (retired → cancelled, resolved → succeeded); never active (D9)', () => {
		expect(initiativeStateToMission(State.RETIRED)).toEqual({ status: 'completed', outcome: 'cancelled' });
		expect(initiativeStateToMission(State.RESOLVED)).toEqual({ status: 'completed', outcome: 'succeeded' });
		expect(initiativeStateToMission(State.ACTIVE)).toBeNull();
		expect(initiativeStateToMission(State.DRAFT)).toBeNull();
	});

	it('leadership initiatives never go to Ever Works; drafts wait until active', () => {
		expect(initiativeEligibility({ state: 'active', visibilityScope: 'leadership' })).toBe('leadership');
		expect(initiativeEligibility({ state: 'draft', visibilityScope: 'organization' })).toBe('draft');
		expect(initiativeEligibility({ state: 'active', visibilityScope: 'team' })).toBe('ok');
	});
});

describe('the Ever Works side of an initiative', () => {
	it('takes the title (≤ 200), the intent (or the title), teams, works (keeping Ever Works’ relation) and primary goals', () => {
		const shared = gauzyInitiativeShared(
			{ title: 'T'.repeat(210), intent: '' },
			['ew-t2', 'ew-t1'],
			['w2', 'w1'],
			['g1'],
			{ works: [{ workId: 'w1', relation: 'operates' }], status: 'paused' }
		);
		expect(shared.title).toHaveLength(200);
		expect(shared.description).toBe(shared.title);
		expect(shared.teamIds).toEqual(['ew-t1', 'ew-t2']);
		expect(shared.works).toEqual([
			{ workId: 'w1', relation: 'operates' },
			{ workId: 'w2', relation: 'improves' }
		]);
		// Gauzy never picks the mission's primary goal: there is none in the last sync, so none here.
		expect(shared.goals).toEqual([{ goalId: 'g1', isPrimary: false }]);
		expect(shared.status).toBe('paused');
	});

	it('keeps what Ever Works has that Gauzy cannot show, and Ever Works’ primary goal', () => {
		const before = {
			goals: [{ goalId: 'g-primary', isPrimary: true }],
			works: [{ workId: 'w-unpaired', relation: 'created' }]
		};
		const shared = gauzyInitiativeShared(
			{ title: 'Win SMB', intent: 'Grow' },
			[],
			[],
			['g-primary', 'g2'],
			before,
			{
				teamIds: ['ew-team-unpaired'],
				workIds: ['w-unpaired'],
				goalIds: ['g-other-initiative']
			}
		);
		expect(shared.teamIds).toEqual(['ew-team-unpaired']);
		expect(shared.works).toEqual([{ workId: 'w-unpaired', relation: 'created' }]);
		expect(shared.goals).toEqual([
			{ goalId: 'g-other-initiative', isPrimary: false },
			{ goalId: 'g-primary', isPrimary: true },
			{ goalId: 'g2', isPrimary: false }
		]);
	});

	it('the push plan sends only what differs, and finishes a mission once', () => {
		const before = everWorksMissionShared({
			id: 'm1',
			title: 'Win SMB',
			description: 'Grow',
			teamIds: [],
			works: [{ workId: 'w1', relation: 'created' }],
			goals: [],
			status: 'paused'
		});
		const now = gauzyInitiativeShared({ title: 'Win SMB', intent: 'Grow' }, [], ['w1'], [], before);
		expect(missionPushPlan(now, before, null)).toEqual({ patch: null, works: false, goals: false });
		expect(missionPushPlan({ ...now, teamIds: ['ew-t1'] }, before, null).patch).toEqual({
			teamIds: ['ew-t1'],
			visibility: 'team'
		});
		expect(missionPushPlan(now, before, { status: 'completed', outcome: 'cancelled' }).patch).toEqual({
			status: 'completed',
			outcome: 'cancelled'
		});
		expect(
			missionPushPlan(now, { ...before, status: 'completed' }, { status: 'completed', outcome: 'cancelled' })
				.patch
		).toBeNull();
		expect(missionPushPlan({ ...now, works: [] }, before, null).works).toBe(true);
	});

	it('the create body has no status or type (Ever Works creates it paused and one-shot), linked back', () => {
		const body = missionCreateBody(
			gauzyInitiativeShared({ title: 'Win SMB', intent: 'Grow' }, ['ew-t1'], [], []),
			'c1',
			'init-1'
		);
		expect(body).toEqual({
			title: 'Win SMB',
			description: 'Grow',
			teamIds: ['ew-t1'],
			visibility: 'team',
			externalRef: { source: 'gauzy', installationId: 'c1', externalId: 'init-1' }
		});
		expect(
			gauzyInitiativeOf(
				{ id: 'm1', externalLinks: [{ source: 'gauzy', installationId: 'c1', externalId: 'init-1' }] },
				'c1'
			)
		).toBe('init-1');
		expect(sameTitle(' Win SMB ', 'win smb')).toBe(true);
	});
});
