import { DatabaseTypeEnum } from "@gauzy/config";
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
 * Generates a SQL query string for calculating the total duration of tasks today.
 *
 * @param dbType The type of database (e.g., 'sqlite', 'postgres', 'mysql', etc.).
 * @param queryAlias The alias used for the table in the SQL query.
 * @returns The SQL query string for calculating task duration for Today.
 */
export const getTasksTodayDurationQueryString = (dbType: string, queryAlias: string) => {
    switch (dbType) {
        case DatabaseTypeEnum.sqlite:
        case DatabaseTypeEnum.betterSqlite3:
            return `COALESCE(ROUND(SUM((julianday(COALESCE("${queryAlias}"."stoppedAt", datetime('now'))) - julianday("${queryAlias}"."startedAt")) * 86400) / COUNT("time_slot"."id")), 0)`;
        case DatabaseTypeEnum.postgres:
            return `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("${queryAlias}"."stoppedAt", NOW()) - "${queryAlias}"."startedAt"))) / COUNT("time_slot"."id")), 0)`;
        case DatabaseTypeEnum.mysql:
            return p(`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "${queryAlias}"."startedAt", COALESCE("${queryAlias}"."stoppedAt", NOW()))) / COUNT("time_slot"."id")), 0)`);
        default:
            throw new Error(`Unsupported database type: ${dbType}`);
    }
};

/**
 * Generates SQL query string for task duration based on database type and query variation.
 *
 * @param dbType The type of database (e.g., 'sqlite', 'postgres', 'mysql', etc.).
 * @param queryAlias The alias used for the table in the SQL query.
 * @returns The SQL query string for calculating task duration.
 */
export const getTasksDurationQueryString = (dbType: string, queryAlias: string) => {
    switch (dbType) {
        case DatabaseTypeEnum.sqlite:
        case DatabaseTypeEnum.betterSqlite3:
            return `COALESCE(ROUND(SUM((julianday(COALESCE("${queryAlias}"."stoppedAt", datetime('now'))) - julianday("${queryAlias}"."startedAt")) * 86400) / COUNT("time_slot"."id")), 0)`;
        case DatabaseTypeEnum.postgres:
            return `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("${queryAlias}"."stoppedAt", NOW()) - "${queryAlias}"."startedAt"))) / COUNT("time_slot"."id")), 0)`;
        case DatabaseTypeEnum.mysql:
            return `COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "${queryAlias}"."startedAt", COALESCE("${queryAlias}"."stoppedAt", NOW()))) / COUNT("time_slot"."id")), 0)`;
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
export const getTasksTotalDurationQueryString = (dbType: string, queryAlias: string): string => {
    switch (dbType) {
        case DatabaseTypeEnum.sqlite:
        case DatabaseTypeEnum.betterSqlite3:
            return `COALESCE(ROUND(SUM((julianday(COALESCE("${queryAlias}"."stoppedAt", datetime('now'))) - julianday("${queryAlias}"."startedAt")) * 86400)), 0)`;
        case DatabaseTypeEnum.postgres:
            return `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("${queryAlias}"."stoppedAt", NOW()) - "${queryAlias}"."startedAt")))), 0)`;
        case DatabaseTypeEnum.mysql:
            return `COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "${queryAlias}"."startedAt", COALESCE("${queryAlias}"."stoppedAt", NOW())))), 0)`;
        default:
            throw Error(`Unsupported database type: ${dbType}`);
    }
};
