import { DatabaseTypeEnum } from '@gauzy/config';
import { sumOverDayWithABreak } from '../testing/day-with-a-break';
import {
	getActivityTimeSlotFilterQueryString,
	getDurationQueryString,
	getTotalDurationQueryString
} from './statistic.helper';

describe('getActivityTimeSlotFilterQueryString', () => {
	const subQuery =
		'SELECT "time_slot"."id" FROM "time_slot" "time_slot" WHERE "time_slot"."startedAt" BETWEEN :startDate AND :endDate';

	it('materialises the slot ids first on Postgres, so the planner cannot fold the sub-query into a join', () => {
		expect(getActivityTimeSlotFilterQueryString(DatabaseTypeEnum.postgres, 'Activity', subQuery)).toBe(
			`"Activity"."timeSlotId" = ANY(ARRAY(${subQuery}))`
		);
	});

	it.each([DatabaseTypeEnum.sqlite, DatabaseTypeEnum.betterSqlite3])('uses a plain IN sub-query on %s', (dbType) => {
		expect(getActivityTimeSlotFilterQueryString(dbType, 'Activity', subQuery)).toBe(
			`"Activity"."timeSlotId" IN (${subQuery})`
		);
	});

	it('uses a plain IN sub-query with backtick quoting on MySQL', () => {
		const mysqlSubQuery = 'SELECT `time_slot`.`id` FROM `time_slot` `time_slot`';
		expect(getActivityTimeSlotFilterQueryString(DatabaseTypeEnum.mysql, 'Activity', mysqlSubQuery)).toBe(
			'`Activity`.`timeSlotId` IN (SELECT `time_slot`.`id` FROM `time_slot` `time_slot`)'
		);
	});

	it('refuses an unknown database', () => {
		expect(() => getActivityTimeSlotFilterQueryString('oracle', 'Activity', subQuery)).toThrow(
			/unsupported database/
		);
	});
});

describe('the duration sums of the statistics count a break for nothing (#11920)', () => {
	it('sums seven hours of work, not eight, over a day with a one-hour break', async () => {
		expect(
			await sumOverDayWithABreak(getTotalDurationQueryString(DatabaseTypeEnum.betterSqlite3, 'time_log'))
		).toBeCloseTo(7 * 3600, 0);
	});

	it.each([DatabaseTypeEnum.postgres, DatabaseTypeEnum.mysql, DatabaseTypeEnum.sqlite])(
		'gives a break no duration on %s, in both sums',
		(dbType) => {
			for (const sql of [
				getTotalDurationQueryString(dbType, 'log'),
				getDurationQueryString(dbType, 'log', 'slot')
			]) {
				expect(sql).toMatch(/WHEN [`"]log[`"]\.[`"]logType[`"] = 'BREAK' THEN 0/);
			}
		}
	);
});
