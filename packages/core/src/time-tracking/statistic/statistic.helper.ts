import { DatabaseTypeEnum } from '@gauzy/config';
import { prepareSQLQuery as p } from './../../database/database.helper';

/**
 * Builds a SELECT statement for the "user_name" column based on the database type.
 *
 * @param dbType
 * @returns
 */
export function concateUserNameExpression(dbType: string): string {
	let expression: string;

	switch (dbType) {
		case DatabaseTypeEnum.sqlite:
		case DatabaseTypeEnum.betterSqlite3:
			expression = `("user"."firstName" || ' ' ||  "user"."lastName")`;
			break;
		case DatabaseTypeEnum.mysql:
		case DatabaseTypeEnum.postgres:
			expression = `CONCAT("user"."firstName", ' ', "user"."lastName")`;
			break;
		default:
			throw new Error(`Cannot create statistic query due to unsupported database type: ${dbType}`);
	}

	return expression;
}

/**
 * Generates a duration query string based on the provided database type, log query alias, and slot query alias.
 *
 * @param dbType The type of database (e.g., sqlite, postgres, mysql).
 * @param logQueryAlias The alias used for the log query.
 * @param slotQueryAlias The alias used for the slot query.
 * @returns A string representing the duration query.
 */
export const getDurationQueryString = (dbType: string, logQueryAlias: string, slotQueryAlias: string): string => {
	switch (dbType) {
		case DatabaseTypeEnum.sqlite:
		case DatabaseTypeEnum.betterSqlite3:
			return `COALESCE(
				ROUND(
					SUM(
						CASE
							WHEN (julianday(COALESCE("${logQueryAlias}"."stoppedAt", datetime('now'))) -
								  julianday("${logQueryAlias}"."startedAt")) * 86400 >= 0
							THEN (julianday(COALESCE("${logQueryAlias}"."stoppedAt", datetime('now'))) -
								  julianday("${logQueryAlias}"."startedAt")) * 86400
							ELSE 0
						END
					) / COUNT("${slotQueryAlias}"."id")
				), 0
			)`;
		case DatabaseTypeEnum.postgres:
			return `COALESCE(
				ROUND(
					SUM(
						CASE
							WHEN extract(epoch from (COALESCE("${logQueryAlias}"."stoppedAt", NOW()) - "${logQueryAlias}"."startedAt")) >= 0
							THEN extract(epoch from (COALESCE("${logQueryAlias}"."stoppedAt", NOW()) - "${logQueryAlias}"."startedAt"))
							ELSE 0
						END
					) / COUNT("${slotQueryAlias}"."id")
				), 0
			)`;
		case DatabaseTypeEnum.mysql:
			return p(`COALESCE(
				ROUND(
					SUM(
						CASE
							WHEN TIMESTAMPDIFF(SECOND, \`${logQueryAlias}\`.\`startedAt\`, COALESCE(\`${logQueryAlias}\`.\`stoppedAt\`, NOW())) >= 0
							THEN TIMESTAMPDIFF(SECOND, \`${logQueryAlias}\`.\`startedAt\`, COALESCE(\`${logQueryAlias}\`.\`stoppedAt\`, NOW()))
							ELSE 0
						END
					) / COUNT(\`${slotQueryAlias}\`.\`id\`)
				), 0
			)`);
		default:
			throw new Error(`Unsupported database type: ${dbType}`);
	}
};

/**
 * Generates a SQL query string for calculating the total duration of tasks across all time.
 * The query varies depending on the database type.
 *
 * @param dbType The type of the database (e.g., SQLite, PostgreSQL, MySQL).
 * @param queryAlias The alias used for the table in the SQL query.
 * @returns The SQL query string for calculating task total duration.
 */
export const getTotalDurationQueryString = (dbType: string, queryAlias: string): string => {
	switch (dbType) {
		case DatabaseTypeEnum.sqlite:
		case DatabaseTypeEnum.betterSqlite3:
			return `COALESCE(
				ROUND(
					SUM(
						CASE
							WHEN (julianday(COALESCE("${queryAlias}"."stoppedAt", datetime('now'))) -
								  julianday("${queryAlias}"."startedAt")) * 86400 >= 0
							THEN (julianday(COALESCE("${queryAlias}"."stoppedAt", datetime('now'))) -
								  julianday("${queryAlias}"."startedAt")) * 86400
							ELSE 0
						END
					)
				), 0
			)`;
		case DatabaseTypeEnum.postgres:
			return `COALESCE(
				ROUND(
					SUM(
						CASE
							WHEN extract(epoch from (COALESCE("${queryAlias}"."stoppedAt", NOW()) - "${queryAlias}"."startedAt")) >= 0
							THEN extract(epoch from (COALESCE("${queryAlias}"."stoppedAt", NOW()) - "${queryAlias}"."startedAt"))
							ELSE 0
						END
					)
				), 0
			)`;
		case DatabaseTypeEnum.mysql:
			return p(`COALESCE(
				ROUND(
					SUM(
						CASE
							WHEN TIMESTAMPDIFF(SECOND, \`${queryAlias}\`.\`startedAt\`, COALESCE(\`${queryAlias}\`.\`stoppedAt\`, NOW())) >= 0
							THEN TIMESTAMPDIFF(SECOND, \`${queryAlias}\`.\`startedAt\`, COALESCE(\`${queryAlias}\`.\`stoppedAt\`, NOW()))
							ELSE 0
						END
					)
				), 0
			)`);
		default:
			throw Error(`Unsupported database type: ${dbType}`);
	}
};

/**
 * Generates the SQL query string for filtering activity duration based on database type.
 *
 * @param dbType The type of the database (e.g., sqlite, postgres, mysql).
 * @param queryAlias The alias used for the query table in SQL.
 * @returns The SQL query string for filtering activity duration.
 */
export const getActivityDurationQueryString = (dbType: string, queryAlias: string): string => {
	switch (dbType) {
		case DatabaseTypeEnum.sqlite:
		case DatabaseTypeEnum.betterSqlite3:
			return `datetime("${queryAlias}"."date" || ' ' || "${queryAlias}"."time") Between :start AND :end`;
		case DatabaseTypeEnum.postgres:
			return `CONCAT("${queryAlias}"."date", ' ', "${queryAlias}"."time")::timestamp Between :start AND :end`;
		case DatabaseTypeEnum.mysql:
			return p(`CONCAT(\`${queryAlias}\`.\`date\`, ' ', \`${queryAlias}\`.\`time\`) BETWEEN :start AND :end`);
		default:
			throw Error(`cannot create statistic query due to unsupported database type: ${dbType}`);
	}
};
