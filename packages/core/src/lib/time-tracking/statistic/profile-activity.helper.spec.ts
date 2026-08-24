import { IGetProfileActivity } from '@gauzy/contracts';
import {
	buildProfileActivityResponse,
	ProfileActivityRawRow,
	resolveProfileActivityPeriod
} from './profile-activity.helper';

const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const EMPLOYEE_ID = '00000000-0000-4000-8000-000000000002';

function createRequest(overrides: Partial<IGetProfileActivity> = {}): IGetProfileActivity {
	return {
		organizationId: ORGANIZATION_ID,
		employeeId: EMPLOYEE_ID,
		startDate: '2026-01-01',
		endDate: '2026-01-03',
		timeZone: 'UTC',
		...overrides
	};
}

function buildResponse(request: IGetProfileActivity, rows: ProfileActivityRawRow[]) {
	return buildProfileActivityResponse(request, resolveProfileActivityPeriod(request), rows);
}

function asRuntimeRow(value: unknown): ProfileActivityRawRow {
	return value as ProfileActivityRawRow;
}

describe('profile activity period', () => {
	it('resolves Madrid summer date labels to their actual half-open IANA instants', () => {
		const period = resolveProfileActivityPeriod(
			createRequest({ startDate: '2026-08-01', endDate: '2026-08-02', timeZone: 'Europe/Madrid' })
		);

		expect(period.startDate.toISOString()).toBe('2026-07-31T22:00:00.000Z');
		expect(period.endDate.toISOString()).toBe('2026-08-01T22:00:00.000Z');
		expect(period.timeZone).toBe('Europe/Madrid');
	});

	it.each([
		['Europe/Madrid', '2024-03-31', '2024-04-01', '2024-03-30T23:00:00.000Z', '2024-03-31T22:00:00.000Z', 23],
		['Europe/Madrid', '2024-10-27', '2024-10-28', '2024-10-26T22:00:00.000Z', '2024-10-27T23:00:00.000Z', 25],
		['America/Santiago', '2018-08-12', '2018-08-13', '2018-08-12T04:00:00.000Z', '2018-08-13T03:00:00.000Z', 23]
	])(
		'resolves the %s transition from %s to %s without assuming a 24-hour day',
		(timeZone, startDate, endDate, expectedStart, expectedEnd, expectedHours) => {
			const period = resolveProfileActivityPeriod(createRequest({ startDate, endDate, timeZone }));

			expect(period.startDate.toISOString()).toBe(expectedStart);
			expect(period.endDate.toISOString()).toBe(expectedEnd);
			expect((period.endDate.getTime() - period.startDate.getTime()) / 3_600_000).toBe(expectedHours);
		}
	);
});

describe('profile activity response', () => {
	it('returns an empty summary without structurally adding daily by default', () => {
		const request = createRequest();
		const response = buildResponse(request, []);

		expect(response).toEqual({
			employeeId: EMPLOYEE_ID,
			activeDays: 0,
			totalDuration: 0,
			firstActiveOn: null,
			lastActiveOn: null,
			period: {
				startDate: '2026-01-01',
				endDate: '2026-01-03',
				timeZone: 'UTC'
			}
		});
		expect(Object.prototype.hasOwnProperty.call(response, 'daily')).toBe(false);
	});

	it('returns an empty daily array only when explicitly requested', () => {
		const response = buildResponse(createRequest({ includeDaily: true }), []);

		expect(response.daily).toEqual([]);
	});

	it('echoes request date labels instead of exposing query boundary instants', () => {
		const request = createRequest({
			startDate: '2026-08-01',
			endDate: '2026-08-03',
			timeZone: 'Europe/Madrid'
		});
		const response = buildResponse(request, []);

		expect(response.period).toEqual({
			startDate: '2026-08-01',
			endDate: '2026-08-03',
			timeZone: 'Europe/Madrid'
		});
	});

	it('coalesces numeric aggregate rows, sorts dates, and preserves year boundaries', () => {
		const request = createRequest({
			startDate: '2025-12-30',
			endDate: '2026-01-03',
			includeDaily: true
		});
		const response = buildResponse(request, [
			{ date: '2026-01-01', duration: 1 },
			{ date: '2025-12-31', duration: '0.1' },
			{ date: '2025-12-31', duration: '0.2' }
		]);

		expect(response).toMatchObject({
			activeDays: 2,
			totalDuration: 1.3,
			firstActiveOn: '2025-12-31',
			lastActiveOn: '2026-01-01',
			daily: [
				{ date: '2025-12-31', duration: 0.3 },
				{ date: '2026-01-01', duration: 1 }
			]
		});
		expect(typeof response.activeDays).toBe('number');
		expect(typeof response.totalDuration).toBe('number');
		response.daily?.forEach(({ duration }) => expect(typeof duration).toBe('number'));
	});

	it.each([null, undefined, '', ' ', true, false, {}, NaN, Infinity, -1, 0, 'NaN', 'Infinity', '-1', '0'])(
		'ignores invalid aggregate duration %p',
		(duration) => {
			const response = buildResponse(createRequest({ includeDaily: true }), [
				asRuntimeRow({ date: '2026-01-01', duration })
			]);

			expect(response.activeDays).toBe(0);
			expect(response.totalDuration).toBe(0);
			expect(response.daily).toEqual([]);
		}
	);

	it('rounds aggregate seconds to integer milliseconds and drops values that round to zero', () => {
		const response = buildResponse(createRequest({ includeDaily: true }), [
			{ date: '2026-01-01', duration: '0.0004' },
			{ date: '2026-01-02', duration: '0.0006' }
		]);

		expect(response.activeDays).toBe(1);
		expect(response.totalDuration).toBe(0.001);
		expect(response.daily).toEqual([{ date: '2026-01-02', duration: 0.001 }]);
	});

	it.each([null, '', '2026-1-01', '2026-02-30', 'not-a-date'])(
		'ignores an invalid aggregate date label %p',
		(date) => {
			const response = buildResponse(createRequest(), [asRuntimeRow({ date, duration: 1 })]);

			expect(response.activeDays).toBe(0);
			expect(response.totalDuration).toBe(0);
		}
	);

	it('keeps 100 ms plus 200 ms exactly aligned across aggregate and projection paths', () => {
		const request = createRequest({ includeDaily: true });
		const aggregateResponse = buildResponse(request, [
			{ date: '2026-01-01', duration: '0.1' },
			{ date: '2026-01-01', duration: '0.2' }
		]);
		const projectionResponse = buildResponse(request, [
			{
				startedAt: '2026-01-01 00:00:00.000',
				stoppedAt: '2026-01-01 00:00:00.100'
			},
			{
				startedAt: '2026-01-01 01:00:00.000',
				stoppedAt: '2026-01-01 01:00:00.200'
			}
		]);

		expect(aggregateResponse.totalDuration).toBe(0.3);
		expect(projectionResponse).toEqual(aggregateResponse);
	});

	it('counts a positive subsecond projection as an active day', () => {
		const response = buildResponse(createRequest({ includeDaily: true }), [
			{
				startedAt: '2026-01-01T00:00:00.000Z',
				stoppedAt: '2026-01-01T00:00:00.001Z'
			}
		]);

		expect(response.activeDays).toBe(1);
		expect(response.totalDuration).toBe(0.001);
		expect(response.daily).toEqual([{ date: '2026-01-01', duration: 0.001 }]);
	});

	it('parses SQLite UTC-naive timestamps as UTC even when the Node host uses Madrid time', () => {
		const originalTimeZone = process.env.TZ;
		process.env.TZ = 'Europe/Madrid';

		try {
			const response = buildResponse(createRequest({ includeDaily: true }), [
				{
					startedAt: '2026-01-01 00:30:00.000',
					stoppedAt: '2026-01-01 01:30:00.000'
				}
			]);

			expect(response.daily).toEqual([{ date: '2026-01-01', duration: 3600 }]);
		} finally {
			if (originalTimeZone === undefined) {
				delete process.env.TZ;
			} else {
				process.env.TZ = originalTimeZone;
			}
		}
	});

	it('preserves offset-bearing strings and Date objects as their represented instants', () => {
		const response = buildResponse(
			createRequest({
				startDate: '2025-12-31',
				endDate: '2026-01-02',
				timeZone: 'America/New_York',
				includeDaily: true
			}),
			[
				{
					startedAt: '2026-01-01T01:30:00+02:00',
					stoppedAt: new Date('2025-12-31T23:45:00.000Z')
				}
			]
		);

		expect(response.daily).toEqual([{ date: '2025-12-31', duration: 900 }]);
	});

	it('maps UTC midnight and a Madrid next-day instant to their requested local dates', () => {
		const utcResponse = buildResponse(createRequest({ includeDaily: true }), [
			{
				startedAt: '2026-01-01T00:00:00.000Z',
				stoppedAt: '2026-01-01T00:00:01.000Z'
			}
		]);
		const madridResponse = buildResponse(
			createRequest({
				startDate: '2026-07-01',
				endDate: '2026-07-03',
				timeZone: 'Europe/Madrid',
				includeDaily: true
			}),
			[
				{
					startedAt: '2026-07-01T22:30:00.000Z',
					stoppedAt: '2026-07-01T22:30:01.000Z'
				}
			]
		);

		expect(utcResponse.daily).toEqual([{ date: '2026-01-01', duration: 1 }]);
		expect(madridResponse.daily).toEqual([{ date: '2026-07-02', duration: 1 }]);
	});

	it('uses actual elapsed time through a DST jump', () => {
		const response = buildResponse(
			createRequest({
				startDate: '2024-03-31',
				endDate: '2024-04-01',
				timeZone: 'Europe/Madrid',
				includeDaily: true
			}),
			[
				{
					startedAt: '2024-03-31T00:30:00+01:00',
					stoppedAt: '2024-03-31T03:30:00+02:00'
				}
			]
		);

		expect(response.totalDuration).toBe(7200);
		expect(response.daily).toEqual([{ date: '2024-03-31', duration: 7200 }]);
	});

	it('assigns an entire cross-midnight log to the local date where it started', () => {
		const response = buildResponse(
			createRequest({
				startDate: '2026-01-01',
				endDate: '2026-01-03',
				timeZone: 'Europe/Madrid',
				includeDaily: true
			}),
			[
				{
					startedAt: '2026-01-01T22:30:00.000Z',
					stoppedAt: '2026-01-02T00:30:00.000Z'
				}
			]
		);

		expect(response.activeDays).toBe(1);
		expect(response.daily).toEqual([{ date: '2026-01-01', duration: 7200 }]);
	});

	it('coalesces repeated unsorted projection dates', () => {
		const response = buildResponse(createRequest({ includeDaily: true }), [
			{
				startedAt: '2026-01-02T01:00:00.000Z',
				stoppedAt: '2026-01-02T01:00:02.000Z'
			},
			{
				startedAt: '2026-01-01T01:00:00.000Z',
				stoppedAt: '2026-01-01T01:00:01.000Z'
			},
			{
				startedAt: '2026-01-02T02:00:00.000Z',
				stoppedAt: '2026-01-02T02:00:03.000Z'
			}
		]);

		expect(response.daily).toEqual([
			{ date: '2026-01-01', duration: 1 },
			{ date: '2026-01-02', duration: 5 }
		]);
	});

	it.each([
		{ startedAt: null, stoppedAt: '2026-01-01T00:00:01.000Z' },
		{ startedAt: 'invalid', stoppedAt: '2026-01-01T00:00:01.000Z' },
		{ startedAt: '2026-01-01T00:00:01.000Z', stoppedAt: 'invalid' },
		{ startedAt: '2026-01-01T00:00:01.000Z', stoppedAt: '2026-01-01T00:00:01.000Z' },
		{ startedAt: '2026-01-01T00:00:02.000Z', stoppedAt: '2026-01-01T00:00:01.000Z' },
		{ startedAt: {}, stoppedAt: [] },
		{ unexpected: 'shape' }
	])('ignores invalid, equal, reversed, or malformed projection row %#', (row) => {
		const response = buildResponse(createRequest({ includeDaily: true }), [asRuntimeRow(row)]);

		expect(response.activeDays).toBe(0);
		expect(response.totalDuration).toBe(0);
		expect(response.daily).toEqual([]);
	});

	it('does not add daily for a truthy runtime value other than boolean true', () => {
		const request = createRequest({ includeDaily: 'true' as unknown as boolean });
		const response = buildResponse(request, [{ date: '2026-01-01', duration: 1 }]);

		expect(Object.prototype.hasOwnProperty.call(response, 'daily')).toBe(false);
	});
});
