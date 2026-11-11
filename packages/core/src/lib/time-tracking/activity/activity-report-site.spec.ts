import { DatabaseTypeEnum } from '@gauzy/config';
import { activityTypeSelect, visitedAddressSelect } from './activity-report-site';

/**
 * ever-co/ever-teams#5023: the select expressions of a daily report row's activity type and visited address, per
 * dialect. What they answer on real rows is in `activity.service.report-site.spec.ts`.
 */
describe('the daily report row of an app or a site', () => {
	it('reads the activity type with the grouping kept, the identifiers quoted for the dialect', () => {
		expect(activityTypeSelect('activity', DatabaseTypeEnum.postgres)).toBe('MAX("activity"."type")');
		expect(activityTypeSelect('activity', DatabaseTypeEnum.betterSqlite3)).toBe('MAX("activity"."type")');
		expect(activityTypeSelect('activity', DatabaseTypeEnum.mysql)).toBe('MAX(`activity`.`type`)');
	});

	it("reads a site's address from its URL activities only, with each dialect's JSON functions", () => {
		expect(visitedAddressSelect('activity', DatabaseTypeEnum.postgres)).toBe(
			`MAX(CASE WHEN "activity"."type" = 'URL' AND json_typeof("activity"."metaData" -> 'url') = 'string' THEN "activity"."metaData" ->> 'url' END)`
		);
		// Only a JSON string: JSON_UNQUOTE answers the text "null" for a JSON null
		expect(visitedAddressSelect('activity', DatabaseTypeEnum.mysql)).toBe(
			"MAX(CASE WHEN `activity`.`type` = 'URL' AND JSON_TYPE(JSON_EXTRACT(`activity`.`metaData`, '$.url')) = 'STRING' THEN JSON_UNQUOTE(JSON_EXTRACT(`activity`.`metaData`, '$.url')) END)"
		);
		for (const sqlite of [DatabaseTypeEnum.sqlite, DatabaseTypeEnum.betterSqlite3]) {
			// A text column there: a value that is not JSON is left out instead of failing the report
			expect(visitedAddressSelect('activity', sqlite)).toBe(
				`MAX(CASE WHEN "activity"."type" = 'URL' AND json_valid("activity"."metaData") THEN CASE WHEN json_type("activity"."metaData", '$.url') = 'text' THEN json_extract("activity"."metaData", '$.url') END END)`
			);
		}
	});

	it('answers no address on a dialect it does not know, rather than SQL it might not run', () => {
		expect(visitedAddressSelect('activity', 'mongodb' as DatabaseTypeEnum)).toBe('NULL');
	});
});
