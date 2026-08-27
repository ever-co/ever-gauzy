import moment from 'moment-timezone';
import { IActivitiesStatistics, IMembersStatistics, IOrganization } from '@gauzy/contracts';

/*
 * `@gauzy/ui-core/common` and `@gauzy/ui-core/shared` are Angular barrels (hundreds of components,
 * Swiper, CKEditor…) — far too heavy for a helper spec. The two functions the payload builder
 * takes from them are re-declared here with their real one-line bodies
 * (`shared-utils.ts#toUtcOffset` / `#isNotEmpty`, `date-picker.utils.ts#getAdjustDateRangeFutureAllowed`
 * reduced to its identity branch), so this spec exercises OUR payload assembly, not their internals.
 */
jest.mock('@gauzy/ui-core/common', () => {
	const m = jest.requireActual('moment-timezone');
	return {
		toUtcOffset: (date: unknown, timezone?: string) => {
			const utcOffset = timezone ? m.tz(timezone).utcOffset() : m().utcOffset();
			return m(date as string).clone().subtract(utcOffset, 'minutes');
		},
		isNotEmpty: (item: unknown) => Array.isArray(item) && item.filter(Boolean).length > 0
	};
});
jest.mock('@gauzy/ui-core/shared', () => {
	const m = jest.requireActual('moment-timezone');
	return {
		getAdjustDateRangeFutureAllowed: (request: { startDate: unknown; endDate: unknown }) => ({
			startDate: m(request.startDate as string).toDate(),
			endDate: m(request.endDate as string).toDate()
		})
	};
});

import { buildStatisticsPayload, normalizeMemberWeekHours, withDurationPercentage } from './payload.utils';

describe('payload.utils — buildStatisticsPayload (Angular `preparePayloads` parity)', () => {
	const organization = { id: 'org-1', tenantId: 'tenant-1' } as IOrganization;
	const dateRange = {
		startDate: moment('2026-08-10T00:00:00').toDate(),
		endDate: moment('2026-08-16T23:59:59').toDate(),
		isCustomDate: false
	};
	const now = moment('2026-08-12T15:30:00');

	it('shifts today and the range by the selected zone offset and formats YYYY-MM-DD HH:mm:ss', () => {
		const payload = buildStatisticsPayload(
			{ organization, dateRange, employeeIds: [], projectIds: [], teamIds: [], timeZone: 'Etc/UTC' },
			now
		);
		const local = moment().utcOffset();
		// UTC has offset 0 → the strings are the local calendar values untouched.
		expect(payload).toEqual({
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			todayStart: now.clone().startOf('day').format('YYYY-MM-DD HH:mm:ss'),
			todayEnd: now.clone().endOf('day').format('YYYY-MM-DD HH:mm:ss'),
			startDate: moment(dateRange.startDate).format('YYYY-MM-DD HH:mm:ss'),
			endDate: moment(dateRange.endDate).format('YYYY-MM-DD HH:mm:ss'),
			timeZone: 'Etc/UTC'
		});
		expect(typeof local).toBe('number');
	});

	it('subtracts the zone offset (Asia/Kolkata = +05:30) from every bound', () => {
		const payload = buildStatisticsPayload(
			{ organization, dateRange, employeeIds: [], projectIds: [], teamIds: [], timeZone: 'Asia/Kolkata' },
			now
		);
		expect(payload.todayStart).toBe(now.clone().startOf('day').subtract(330, 'minutes').format('YYYY-MM-DD HH:mm:ss'));
		expect(payload.startDate).toBe(moment(dateRange.startDate).subtract(330, 'minutes').format('YYYY-MM-DD HH:mm:ss'));
		expect(payload.timeZone).toBe('Asia/Kolkata');
	});

	it('attaches employeeIds / projectIds / teamIds only when non-empty', () => {
		const bare = buildStatisticsPayload(
			{ organization, dateRange, employeeIds: [], projectIds: [], teamIds: [], timeZone: 'Etc/UTC' },
			now
		);
		expect(bare).not.toHaveProperty('employeeIds');
		expect(bare).not.toHaveProperty('projectIds');
		expect(bare).not.toHaveProperty('teamIds');

		const scoped = buildStatisticsPayload(
			{ organization, dateRange, employeeIds: ['e1'], projectIds: ['p1'], teamIds: ['t1'], timeZone: 'Etc/UTC' },
			now
		);
		expect(scoped.employeeIds).toEqual(['e1']);
		expect(scoped.projectIds).toEqual(['p1']);
		expect(scoped.teamIds).toEqual(['t1']);
	});
});

describe('payload.utils — reshaping (Angular getActivities / getMembers parity)', () => {
	it('adds durationPercentage as the share of the summed duration', () => {
		const activities = [{ title: 'a', duration: 30 }, { title: 'b', duration: 10 }] as IActivitiesStatistics[];
		const result = withDurationPercentage(activities);
		expect(result.map((a) => a.durationPercentage)).toEqual([75, 25]);
		// input untouched
		expect(activities[0].durationPercentage).toBeUndefined();
		expect(withDurationPercentage(null)).toEqual([]);
		expect(withDurationPercentage([{ title: 'z', duration: 0 }] as IActivitiesStatistics[])[0].durationPercentage).toBe(0);
	});

	it('normalises weekHours to seven day bars holding the share of the weekly total', () => {
		const members = [
			{
				id: 'm1',
				weekHours: [
					{ day: 1, duration: 60 },
					{ day: 3, duration: 20 }
				]
			}
		] as IMembersStatistics[];
		const [member] = normalizeMemberWeekHours(members);
		expect(member.weekHours).toHaveLength(7);
		expect(member.weekHours?.map((w) => w.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
		expect(member.weekHours?.[1].duration).toBe(75);
		expect(member.weekHours?.[3].duration).toBe(25);
		expect(member.weekHours?.[0].duration).toBe(0);
		expect(normalizeMemberWeekHours(undefined)).toEqual([]);
		expect(normalizeMemberWeekHours([{ id: 'x' }] as IMembersStatistics[])[0].weekHours?.every((w) => w.duration === 0)).toBe(true);
	});
});
