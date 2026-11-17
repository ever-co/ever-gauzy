import { IReportDayGroupByDate, SAVED_REPORT_NO_CLIENT } from '@gauzy/contracts';
import {
	ISavedReportRate,
	keepPickedClients,
	memberIdsOf,
	projectIdsOf,
	publicDaysOf,
	publicTotalsOf
} from './saved-report-public';

const CLIENT_A = 'c1000000-0000-4000-8000-00000000000a';
const WEBSITE = 'b1000000-0000-4000-8000-00000000000a';
const MEETINGS = 'b1000000-0000-4000-8000-00000000000b';
const MARIE = 'e1000000-0000-4000-8000-00000000000a';
const PAUL = 'e1000000-0000-4000-8000-00000000000b';

/** A member as the daily report loads them: with an e-mail, a picture and presence flags. */
function employee(id: string, firstName: string, lastName: string) {
	return {
		id,
		userId: `${id}-user`,
		isAway: false,
		isOnline: true,
		fullName: `${firstName} ${lastName}`,
		user: {
			id: `${id}-user`,
			firstName,
			lastName,
			name: `${firstName} ${lastName}`,
			email: `${firstName.toLowerCase()}@example.com`,
			imageUrl: 'https://example.com/avatar.png'
		}
	};
}

/** One day as GET /timesheet/time-log/report/daily answers it, grouped by date. */
function day(): IReportDayGroupByDate {
	return {
		date: '2026-11-02',
		sum: 5 * 3600 + 1800,
		activity: 61.5,
		logs: [
			{
				project: {
					id: WEBSITE,
					name: 'Website',
					imageUrl: 'https://example.com/website.png',
					membersCount: 3,
					organizationContactId: CLIENT_A,
					organizationContact: { id: CLIENT_A, name: 'Client A', imageUrl: 'https://example.com/a.png' }
				},
				employeeLogs: [
					{
						employee: employee(MARIE, 'Marie', 'Curie'),
						sum: 3 * 3600,
						activity: 70,
						tasks: [
							{
								task: {
									id: 'f1000000-0000-4000-8000-00000000000a',
									title: 'Fix the login page',
									number: 12,
									prefix: 'WEB',
									description: 'Internal notes about the client',
									estimate: 7200
								},
								description: 'Called the client about the invoice',
								duration: 3 * 3600,
								client: { id: CLIENT_A, name: 'Client A', imageUrl: 'https://example.com/a.png' }
							}
						]
					}
				]
			},
			{
				project: { id: MEETINGS, name: 'Meetings', organizationContact: null },
				employeeLogs: [
					{
						employee: employee(PAUL, 'Paul', 'Dirac'),
						sum: 2 * 3600 + 1800,
						activity: 40,
						tasks: [{ task: null, description: 'Private notes', duration: 2 * 3600 + 1800, client: null }]
					}
				]
			}
		]
	} as unknown as IReportDayGroupByDate;
}

/** Every key of a value, at any depth. */
function keysOf(value: unknown, keys = new Set<string>()): Set<string> {
	if (Array.isArray(value)) {
		value.forEach((item) => keysOf(item, keys));
		return keys;
	}
	if (value && typeof value === 'object') {
		for (const [key, item] of Object.entries(value)) {
			keys.add(key);
			keysOf(item, keys);
		}
	}
	return keys;
}

describe('publicDaysOf', () => {
	it('keeps dates, durations and the names of members, projects, clients and tasks', () => {
		const [publicDay] = publicDaysOf([day()], null);

		expect(publicDay.date).toBe('2026-11-02');
		expect(publicDay.sum).toBe(5 * 3600 + 1800);
		expect(publicDay.logs[0].project).toEqual({
			id: WEBSITE,
			name: 'Website',
			color: null,
			organizationContact: { id: CLIENT_A, name: 'Client A' }
		});
		expect(publicDay.logs[0].employeeLogs[0]).toEqual({
			employee: {
				id: MARIE,
				fullName: 'Marie Curie',
				user: { firstName: 'Marie', lastName: 'Curie', name: 'Marie Curie' }
			},
			sum: 3 * 3600,
			tasks: [
				{
					task: {
						id: 'f1000000-0000-4000-8000-00000000000a',
						title: 'Fix the login page',
						number: 12,
						prefix: 'WEB'
					},
					duration: 3 * 3600,
					client: { id: CLIENT_A, name: 'Client A' }
				}
			]
		});
		expect(publicDay.logs[1].employeeLogs[0].tasks).toEqual([
			{ task: null, duration: 2 * 3600 + 1800, client: null }
		]);
	});

	it('carries no rate, no amount, no notes, no activity, no e-mail and no picture when amounts are left out', () => {
		const keys = keysOf(publicDaysOf([day()], null));

		for (const key of [
			'billRateValue',
			'billRateCurrency',
			'amount',
			'description',
			'activity',
			'email',
			'imageUrl',
			'estimate'
		]) {
			expect(keys.has(key)).toBe(false);
		}
	});

	it('states each member rate and what their time is worth when amounts are shared, and no amount without a rate', () => {
		const rates = new Map<string, ISavedReportRate>([[MARIE, { billRateValue: 40, billRateCurrency: 'EUR' }]]);
		const [publicDay] = publicDaysOf([day()], rates);

		expect(publicDay.logs[0].employeeLogs[0].employee).toMatchObject({
			billRateValue: 40,
			billRateCurrency: 'EUR'
		});
		expect(publicDay.logs[0].employeeLogs[0].amount).toBe(120);
		expect(publicDay.logs[1].employeeLogs[0].employee).toMatchObject({
			billRateValue: null,
			billRateCurrency: null
		});
		expect(publicDay.logs[1].employeeLogs[0].amount).toBeNull();
	});

	it('keeps the team of each entry when the report counts the time without a team', () => {
		const withTeams = day();
		withTeams.logs[0].employeeLogs[0].tasks[0].organizationTeamId = 'a1000000-0000-4000-8000-00000000000a';
		withTeams.logs[1].employeeLogs[0].tasks[0].organizationTeamId = null;

		const [publicDay] = publicDaysOf([withTeams], null);

		expect(publicDay.logs[0].employeeLogs[0].tasks[0].organizationTeamId).toBe(
			'a1000000-0000-4000-8000-00000000000a'
		);
		expect(publicDay.logs[1].employeeLogs[0].tasks[0].organizationTeamId).toBeNull();
	});
});

describe('keepPickedClients', () => {
	const projectClients = new Map<string, string | null>([
		[WEBSITE, CLIENT_A],
		[MEETINGS, null]
	]);

	it('keeps the time of the picked client only, and counts the day again', () => {
		const [kept] = keepPickedClients([day()], [CLIENT_A], projectClients);

		expect(kept.logs.map((log) => log.project?.id)).toEqual([WEBSITE]);
		expect(kept.sum).toBe(3 * 3600);
	});

	it('keeps the time without a client for "none", including time without a project', () => {
		const withoutProject = day();
		withoutProject.logs[0].project = null;

		const [kept] = keepPickedClients([withoutProject], [SAVED_REPORT_NO_CLIENT], projectClients);

		expect(kept.logs).toHaveLength(2);
		expect(kept.sum).toBe(5 * 3600 + 1800);
	});

	it('leaves out a day with nothing left, and keeps every day when no client is picked', () => {
		expect(keepPickedClients([day()], ['c1000000-0000-4000-8000-0000000000ff'], projectClients)).toEqual([]);
		expect(keepPickedClients([day()], [], projectClients)).toEqual([day()]);
	});
});

describe('publicTotalsOf', () => {
	it('adds the time of every member, and amounts per currency without ever adding two currencies', () => {
		const rates = new Map<string, ISavedReportRate>([
			[MARIE, { billRateValue: 40, billRateCurrency: 'EUR' }],
			[PAUL, { billRateValue: 50, billRateCurrency: 'USD' }]
		]);
		const totals = publicTotalsOf(publicDaysOf([day(), day()], rates), true);

		expect(totals.duration).toBe(2 * (5 * 3600 + 1800));
		expect(totals.amounts).toEqual([
			{ currency: 'EUR', amount: 240 },
			{ currency: 'USD', amount: 250 }
		]);
	});

	it('states no amounts when they are left out', () => {
		const totals = publicTotalsOf(publicDaysOf([day()], null), false);

		expect(totals).toEqual({ duration: 5 * 3600 + 1800 });
	});
});

describe('amounts in currencies without two decimals', () => {
	it('rounds each amount once to its currency minor unit, as an invoice line does', () => {
		const rates = new Map<string, ISavedReportRate>([
			[MARIE, { billRateValue: 1501, billRateCurrency: 'JPY' }],
			[PAUL, { billRateValue: 7.25, billRateCurrency: 'KWD' }]
		]);
		const halfHour = day();
		halfHour.logs[0].employeeLogs[0].sum = 1800;
		halfHour.logs[1].employeeLogs[0].sum = 1000;

		const days = publicDaysOf([halfHour, halfHour], rates);

		expect(days[0].logs[0].employeeLogs[0].amount).toBe(751);
		expect(days[0].logs[1].employeeLogs[0].amount).toBe(2.014);
		expect(publicTotalsOf(days, true).amounts).toEqual([
			{ currency: 'JPY', amount: 1502 },
			{ currency: 'KWD', amount: 4.028 }
		]);
	});
});

describe('a member whose rate changed after the time was logged', () => {
	const USD_ORGANIZATION = { organizationCurrency: 'USD', defaultRate: null };

	/** Marie bills 60 EUR today; Paul bills 50 USD. */
	const todayRates = new Map<string, ISavedReportRate>([
		[MARIE, { billRateValue: 60, billRateCurrency: 'EUR' }],
		[PAUL, { billRateValue: 50, billRateCurrency: 'USD' }]
	]);

	/**
	 * The day as the daily report answers it now: each row states the rate that prices its entry. Marie's 3 hours were
	 * logged when she billed 40 EUR, the rate her log stores; Paul's log stores none, so his row states his rate of
	 * today, in the organization's currency.
	 */
	function loggedAtStoredRates(): IReportDayGroupByDate {
		const logged = day();
		const [marieRow] = logged.logs[0].employeeLogs[0].tasks;
		logged.logs[0].employeeLogs[0].tasks = [{ ...marieRow, billRateValue: 40, billRateCurrency: 'EUR' }];
		const [paulRow] = logged.logs[1].employeeLogs[0].tasks;
		logged.logs[1].employeeLogs[0].tasks = [{ ...paulRow, billRateValue: 50, billRateCurrency: null }];
		return logged;
	}

	/** What the report page shows for the same rows: each row at the rate it states, the organization's currency when it states none. */
	function reportPageAmountsOf(days: IReportDayGroupByDate[]) {
		const byCurrency = new Map<string, number>();
		for (const reportDay of days) {
			for (const projectLog of reportDay.logs) {
				for (const memberLog of projectLog.employeeLogs) {
					for (const row of memberLog.tasks) {
						const currency = row.billRateCurrency || 'USD';
						const amount = ((row.duration ?? 0) / 3600) * Number(row.billRateValue);
						byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + amount);
					}
				}
			}
		}
		return [...byCurrency.entries()].map(([currency, amount]) => ({ currency, amount }));
	}

	it('prices each entry at the rate its log stores, so the link shows the amount the report page shows', () => {
		const logged = loggedAtStoredRates();

		const days = publicDaysOf([logged], todayRates, USD_ORGANIZATION);

		expect(days[0].logs[0].employeeLogs[0].tasks[0]).toMatchObject({ billRateValue: 40, billRateCurrency: 'EUR' });
		expect(days[0].logs[1].employeeLogs[0].tasks[0]).toMatchObject({ billRateValue: 50, billRateCurrency: 'USD' });
		expect(days[0].logs[0].employeeLogs[0].amount).toBe(120);
		expect(publicTotalsOf(days, true).amounts).toEqual(reportPageAmountsOf([logged]));
		expect(publicTotalsOf(days, true).amounts).toEqual([
			{ currency: 'EUR', amount: 120 },
			{ currency: 'USD', amount: 125 }
		]);
	});

	it('prices a day that straddles the rate change entry by entry', () => {
		const logged = loggedAtStoredRates();
		const marie = logged.logs[0].employeeLogs[0];
		const [row] = marie.tasks;
		marie.tasks = [
			{ ...row, duration: 3600, billRateValue: 40, billRateCurrency: 'EUR' },
			{ ...row, duration: 2 * 3600, billRateValue: 60, billRateCurrency: 'EUR' }
		];

		const days = publicDaysOf([logged], todayRates, USD_ORGANIZATION);

		expect(days[0].logs[0].employeeLogs[0].amount).toBe(160);
		expect(publicTotalsOf(days, true).amounts).toEqual(reportPageAmountsOf([logged]));
	});

	it('states each currency of a member whose entries are priced in two, and never adds them', () => {
		const logged = loggedAtStoredRates();
		const marie = logged.logs[0].employeeLogs[0];
		const [row] = marie.tasks;
		marie.tasks = [
			{ ...row, duration: 3600, billRateValue: 40, billRateCurrency: 'EUR' },
			{ ...row, duration: 2 * 3600, billRateValue: 70, billRateCurrency: 'USD' }
		];

		const days = publicDaysOf([logged], todayRates, USD_ORGANIZATION);

		expect(days[0].logs[0].employeeLogs[0].amounts).toEqual([
			{ currency: 'EUR', amount: 40 },
			{ currency: 'USD', amount: 140 }
		]);
		expect(days[0].logs[0].employeeLogs[0].amount).toBeNull();
		expect(publicTotalsOf(days, true).amounts).toEqual([
			{ currency: 'EUR', amount: 40 },
			{ currency: 'USD', amount: 265 }
		]);
	});

	it("prices an entry without a rate at the organization's default, as the report page and the budgets do", () => {
		const logged = loggedAtStoredRates();
		logged.logs[1].employeeLogs[0].tasks[0].billRateValue = 0;

		const days = publicDaysOf([logged], todayRates, {
			organizationCurrency: 'USD',
			defaultRate: { value: 30, currency: 'USD' }
		});

		expect(days[0].logs[1].employeeLogs[0].tasks[0]).toMatchObject({ billRateValue: 30, billRateCurrency: 'USD' });
		expect(publicTotalsOf(days, true).amounts).toEqual([
			{ currency: 'EUR', amount: 120 },
			{ currency: 'USD', amount: 75 }
		]);
	});

	it('states no rate on any entry when amounts are left out', () => {
		const keys = keysOf(publicDaysOf([loggedAtStoredRates()], null, USD_ORGANIZATION));

		for (const key of ['billRateValue', 'billRateCurrency', 'amount', 'amounts']) {
			expect(keys.has(key)).toBe(false);
		}
	});
});

describe('memberIdsOf and projectIdsOf', () => {
	it('name each member and project of the report once', () => {
		expect(memberIdsOf([day(), day()])).toEqual([MARIE, PAUL]);
		expect(projectIdsOf([day(), day()])).toEqual([WEBSITE, MEETINGS]);
	});
});
