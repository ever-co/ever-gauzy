import { DatabaseTypeEnum } from '@gauzy/config';
import { prepareSQLQuery as p } from './../../database/database.helper';

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
 * Filters on the indexed `recordedAt` timestamp column instead of a non-sargable
 * `concat(date, time)::timestamp` expression. The old form had to compute the value for every
 * row, so it could not use an index and forced a full scan of the (very large) activity table.
 * `recordedAt` holds the same instant (date + time) and is covered by the
 * (organizationId, employeeId, recordedAt) / (organizationId, recordedAt) indexes, turning the
 * range filter into an index range scan. Since it is a plain column comparison, the per-dialect
 * concat/cast branching is no longer needed — only identifier quoting differs, handled by `p()`.
 *
 * @param dbType The type of the database (e.g., sqlite, postgres, mysql).
 * @param queryAlias The alias used for the query table in SQL.
 * @returns The SQL query string for filtering activity duration.
 */
export const getActivityDurationQueryString = (dbType: string, queryAlias: string): string => {
	switch (dbType) {
		case DatabaseTypeEnum.sqlite:
		case DatabaseTypeEnum.betterSqlite3:
		case DatabaseTypeEnum.postgres:
			return `"${queryAlias}"."recordedAt" BETWEEN :start AND :end`;
		case DatabaseTypeEnum.mysql:
			return p(`"${queryAlias}"."recordedAt" BETWEEN :start AND :end`);
		default:
			throw Error(`cannot create statistic query due to unsupported database type: ${dbType}`);
	}
};

/**
 * The condition that keeps the activities of the time slots a sub-query names, for the activity statistics.
 *
 * The statistics used to join `activity` to `time_slot`, `time_slot_time_logs` and `time_log` only to apply the
 * time logs' date range and scope. On a large `activity` table (20 million rows on production) the Postgres planner
 * answered that join with a nested loop that, for EVERY time slot of the range, intersected the slot's activities
 * with the organization's whole date range of activities — 1,900 slots × 105,000 index entries: 16.8 s and 1.3 GB
 * of buffer reads for one dashboard widget. With the slots resolved first and the activities read by `timeSlotId`,
 * the same widget takes 107 ms (measured on production with `EXPLAIN (ANALYZE, BUFFERS)`).
 *
 * On Postgres the slot ids are materialised first (`= ANY(ARRAY(...))`, an init plan), so the planner cannot fold
 * the sub-query back into the join it used to produce; elsewhere a plain `IN (...)` sub-query does the same. This
 * is the TypeORM query builder's form; the MikroORM/knex path uses knex's own `whereIn` sub-query on every
 * dialect, because knex parenthesises a bound builder and `ARRAY((SELECT ...))` is a scalar sub-query to Postgres.
 *
 * It also counts an activity once: the joins counted it once per time log of its slot, so an activity of a slot
 * linked to two time logs weighed twice in the durations.
 *
 * @param dbType The type of the database (e.g., sqlite, postgres, mysql).
 * @param activityAlias The alias of the `activity` table in the query.
 * @param timeSlotIdsQuery The SQL of the sub-query that selects the ids of the time slots.
 * @returns The SQL condition.
 */
export const getActivityTimeSlotFilterQueryString = (
	dbType: string,
	activityAlias: string,
	timeSlotIdsQuery: string
): string => {
	switch (dbType) {
		case DatabaseTypeEnum.postgres:
			return `"${activityAlias}"."timeSlotId" = ANY(ARRAY(${timeSlotIdsQuery}))`;
		case DatabaseTypeEnum.sqlite:
		case DatabaseTypeEnum.betterSqlite3:
			return `"${activityAlias}"."timeSlotId" IN (${timeSlotIdsQuery})`;
		case DatabaseTypeEnum.mysql:
			return `\`${activityAlias}\`.\`timeSlotId\` IN (${timeSlotIdsQuery})`;
		default:
			throw Error(`cannot create statistic query due to unsupported database type: ${dbType}`);
	}
};
