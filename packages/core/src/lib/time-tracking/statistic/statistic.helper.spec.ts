import { DatabaseTypeEnum } from '@gauzy/config';
import { getActivityTimeSlotFilterQueryString } from './statistic.helper';

describe('getActivityTimeSlotFilterQueryString', () => {
	const subQuery = 'SELECT "time_slot"."id" FROM "time_slot" "time_slot" WHERE "time_slot"."startedAt" BETWEEN :startDate AND :endDate';

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
		expect(() => getActivityTimeSlotFilterQueryString('oracle', 'Activity', subQuery)).toThrow(/unsupported database/);
	});
});
