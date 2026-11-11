import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * What a client needs to draw a daily report row's icon (ever-co/ever-teams#5023): the report groups the activities
 * by title, and a title alone does not tell an app from a site, nor which site a page title belongs to. These are the
 * select expressions of the row's activity type and of a visited address, for each dialect the report runs on.
 */

/** An identifier quoted the way the dialect does: MySQL would read `"type"` as the string `type`. */
function quoted(identifier: string, databaseType: DatabaseTypeEnum): string {
	return databaseType === DatabaseTypeEnum.mysql ? `\`${identifier}\`` : `"${identifier}"`;
}

function columnOf(alias: string, column: string, databaseType: DatabaseTypeEnum): string {
	return `${quoted(alias, databaseType)}.${quoted(column, databaseType)}`;
}

/**
 * The activity type of a report row (`APP` or `URL`): `MAX` keeps the report's grouping, which a title recorded under
 * both types would otherwise split.
 *
 * @param alias The activity table's alias in the query.
 * @param databaseType The configured dialect.
 */
export function activityTypeSelect(alias: string, databaseType: DatabaseTypeEnum): string {
	return `MAX(${columnOf(alias, 'type', databaseType)})`;
}

/**
 * A visited address of a report row: the `url` the metadata of one of its `URL` activities holds, `NULL` where none
 * holds one. The `APP` activities are left out on purpose: on macOS the desktop timer records the browser's current
 * page in the browser's own entry too, which is not the browser's address.
 *
 * @param alias The activity table's alias in the query.
 * @param databaseType The configured dialect.
 */
export function visitedAddressSelect(alias: string, databaseType: DatabaseTypeEnum): string {
	const type = columnOf(alias, 'type', databaseType);
	const metaData = columnOf(alias, 'metaData', databaseType);
	switch (databaseType) {
		case DatabaseTypeEnum.postgres:
			// A json column: `->>` answers NULL for a value that is not an object
			return `MAX(CASE WHEN ${type} = 'URL' THEN ${metaData} ->> 'url' END)`;
		case DatabaseTypeEnum.mysql:
			return `MAX(CASE WHEN ${type} = 'URL' THEN JSON_UNQUOTE(JSON_EXTRACT(${metaData}, '$.url')) END)`;
		case DatabaseTypeEnum.sqlite:
		case DatabaseTypeEnum.betterSqlite3:
			// A text column: a value that is not JSON must leave the address out, not fail the whole report
			return `MAX(CASE WHEN ${type} = 'URL' AND json_valid(${metaData}) THEN json_extract(${metaData}, '$.url') END)`;
		default:
			return 'NULL';
	}
}
