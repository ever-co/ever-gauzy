import { TimeLogSourceEnum, WeekDaysEnum } from '@gauzy/contracts';
import {
	clientReportOf,
	clientReportPeriodsOf,
	countedEndOf,
	IEmbedClientReportEntry,
	IEmbedClientReportFacts
} from './embed-client-report';

/**
 * The counting of a client report, apart from the database: the organization's days and week, each entry clipped to
 * them, a running timer counted up to the request, and the projects with time, the most first.
 */

const CLIENT = { id: '7c000000-0000-4000-8000-0000000000d1', name: 'Northwind' };
const WEBSITE = { id: '7c000000-0000-4000-8000-0000000000a1', name: 'Website' };
const MOBILE_APP = { id: '7c000000-0000-4000-8000-0000000000a2', name: 'Mobile app' };
const ARCHIVE = { id: '7c000000-0000-4000-8000-0000000000a3', name: 'Archive' };

/** Thursday 19 November 2026, 15:00 in Paris (UTC+1). */
const NOW = new Date('2026-11-19T14:00:00.000Z');
const PARIS = { timeZone: 'Europe/Paris', startWeekOn: null };

const dateOf = (value: string | null): Date | null => {
	if (value === null) {
		return null;
	}
	return new Date(value);
};

const entry = (
	projectId: string,
	startedAt: string,
	stoppedAt: string | null,
	extra: Partial<IEmbedClientReportEntry> = {}
): IEmbedClientReportEntry => ({
	projectId,
	startedAt: new Date(startedAt),
	stoppedAt: dateOf(stoppedAt),
	isRunning: false,
	source: TimeLogSourceEnum.WEB_TIMER,
	...extra
});

const factsOf = (entries: IEmbedClientReportEntry[]): IEmbedClientReportFacts => ({
	client: CLIENT,
	periods: clientReportPeriodsOf(PARIS, NOW),
	projects: [WEBSITE, MOBILE_APP, ARCHIVE],
	entries,
	now: NOW
});

const HOUR = 3600;

describe('client report periods', () => {
	it("counts today and a Monday-to-Sunday week in the organization's zone", () => {
		const periods = clientReportPeriodsOf(PARIS, NOW);

		expect(periods.timeZone).toBe('Europe/Paris');
		expect(periods.today.startDate).toBe('2026-11-19');
		expect(periods.today.from.toISOString()).toBe('2026-11-18T23:00:00.000Z');
		expect(periods.today.until.toISOString()).toBe('2026-11-19T23:00:00.000Z');
		expect([periods.week.startDate, periods.week.endDate]).toEqual(['2026-11-16', '2026-11-22']);
		expect(periods.week.from.toISOString()).toBe('2026-11-15T23:00:00.000Z');
		expect(periods.week.until.toISOString()).toBe('2026-11-22T23:00:00.000Z');
	});

	it("starts the week on the organization's first day of the week", () => {
		const periods = clientReportPeriodsOf({ timeZone: 'Europe/Paris', startWeekOn: WeekDaysEnum.SUNDAY }, NOW);

		expect([periods.week.startDate, periods.week.endDate]).toEqual(['2026-11-15', '2026-11-21']);
	});

	it('counts in UTC for an organization without a zone, or with one the server does not know', () => {
		for (const timeZone of [null, undefined, '', 'Mars/Olympus_Mons']) {
			const periods = clientReportPeriodsOf({ timeZone, startWeekOn: null }, NOW);

			expect(periods.timeZone).toBe('UTC');
			expect(periods.today.from.toISOString()).toBe('2026-11-19T00:00:00.000Z');
			expect(periods.today.until.toISOString()).toBe('2026-11-20T00:00:00.000Z');
		}
	});

	it('ends a week that crosses a change of clocks at its own midnight', () => {
		// Paris moves its clocks back on Sunday 25 October 2026: that week holds 169 hours.
		const periods = clientReportPeriodsOf(PARIS, new Date('2026-10-21T10:00:00.000Z'));

		expect(periods.week.until.diff(periods.week.from, 'hours')).toBe(169);
		expect(periods.week.until.toISOString()).toBe('2026-10-25T23:00:00.000Z');
	});
});

describe('client report', () => {
	it('answers exactly the client, the zone, today, the week and the projects with time', () => {
		const report = clientReportOf(factsOf([entry(WEBSITE.id, '2026-11-19T08:00:00Z', '2026-11-19T09:00:00Z')]));

		expect(report).toStrictEqual({
			client: { id: CLIENT.id, name: 'Northwind' },
			timeZone: 'Europe/Paris',
			today: { date: '2026-11-19', seconds: HOUR },
			week: { start: '2026-11-16', end: '2026-11-22', seconds: HOUR },
			projects: [{ id: WEBSITE.id, name: 'Website', seconds: HOUR }]
		});
	});

	it('splits an entry across midnight between yesterday and today', () => {
		// 23:00 Wednesday to 01:00 Thursday, Paris time
		const report = clientReportOf(factsOf([entry(WEBSITE.id, '2026-11-18T22:00:00Z', '2026-11-19T00:00:00Z')]));

		expect(report.today.seconds).toBe(HOUR);
		expect(report.week.seconds).toBe(2 * HOUR);
	});

	it('counts only the part of an entry inside the week', () => {
		// 23:00 Sunday to 01:00 Monday, and 23:00 Sunday to 01:00 Monday a week later, Paris time
		const report = clientReportOf(
			factsOf([
				entry(MOBILE_APP.id, '2026-11-15T22:00:00Z', '2026-11-16T00:00:00Z'),
				entry(MOBILE_APP.id, '2026-11-22T22:00:00Z', '2026-11-23T00:00:00Z')
			])
		);

		expect(report.week.seconds).toBe(2 * HOUR);
		expect(report.today.seconds).toBe(0);
	});

	it('counts a running timer up to the request, whatever end it stored', () => {
		const running = entry(WEBSITE.id, '2026-11-19T12:30:00Z', '2026-11-19T12:30:00Z', { isRunning: true });

		const report = clientReportOf(factsOf([running]));

		expect(countedEndOf(running, NOW)).toBe(NOW);
		expect(report.today.seconds).toBe(1.5 * HOUR);
		expect(report.week.seconds).toBe(1.5 * HOUR);
	});

	it('counts the rows a tracker stores as running up to their stored end', () => {
		const uploaded = entry(WEBSITE.id, '2026-11-17T08:00:00Z', '2026-11-17T09:00:00Z', {
			isRunning: true,
			source: TimeLogSourceEnum.DESKTOP
		});
		const later = entry(WEBSITE.id, '2026-11-18T08:00:00Z', '2026-11-18T08:30:00Z', {
			isRunning: true,
			source: TimeLogSourceEnum.DESKTOP
		});

		const report = clientReportOf(factsOf([uploaded, later]));

		expect(report.week.seconds).toBe(1.5 * HOUR);
	});

	it('leaves out the entries of any other project, and the projects without time this week', () => {
		const report = clientReportOf(
			factsOf([
				entry(MOBILE_APP.id, '2026-11-17T09:00:00Z', '2026-11-17T09:30:00Z'),
				entry(WEBSITE.id, '2026-11-17T10:00:00Z', '2026-11-17T12:00:00Z'),
				entry(ARCHIVE.id, '2026-11-10T10:00:00Z', '2026-11-10T12:00:00Z'),
				entry('7c000000-0000-4000-8000-0000000000a9', '2026-11-19T08:00:00Z', '2026-11-19T10:00:00Z')
			])
		);

		expect(report.projects).toEqual([
			{ id: WEBSITE.id, name: 'Website', seconds: 2 * HOUR },
			{ id: MOBILE_APP.id, name: 'Mobile app', seconds: 0.5 * HOUR }
		]);
		expect(report.week.seconds).toBe(2.5 * HOUR);
		expect(report.today.seconds).toBe(0);
	});

	it('orders projects with as many seconds by name', () => {
		const report = clientReportOf(
			factsOf([
				entry(WEBSITE.id, '2026-11-17T10:00:00Z', '2026-11-17T11:00:00Z'),
				entry(MOBILE_APP.id, '2026-11-17T12:00:00Z', '2026-11-17T13:00:00Z')
			])
		);

		expect(report.projects.map((project) => project.name)).toEqual(['Mobile app', 'Website']);
	});

	it('answers a client without time this week with zeros and no project', () => {
		const report = clientReportOf(factsOf([]));

		expect(report.today).toEqual({ date: '2026-11-19', seconds: 0 });
		expect(report.week).toEqual({ start: '2026-11-16', end: '2026-11-22', seconds: 0 });
		expect(report.projects).toEqual([]);
	});
});
