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
 * Generates a duration query string based on the provided database type, log query alias, and slot query alias.
 *
 * @param dbType The type of database (e.g., sqlite, postgres, mysql).
 * @param logQueryAlias The alias used for the log query.
 * @param slotQueryAlias The alias used for the slot query.
 * @returns A string representing the duration query.
 */
export const getDurationQueryString = (
    dbType: string,
    logQueryAlias: string,
    slotQueryAlias: string
): string => {
    switch (dbType) {
        case DatabaseTypeEnum.sqlite:
        case DatabaseTypeEnum.betterSqlite3:
            return `COALESCE(ROUND(SUM((julianday(COALESCE("${logQueryAlias}"."stoppedAt", datetime('now'))) - julianday("${logQueryAlias}"."startedAt")) * 86400) / COUNT("${slotQueryAlias}"."id")), 0)`;
        case DatabaseTypeEnum.postgres:
            return `COALESCE(ROUND(SUM(extract(epoch from (COALESCE("${logQueryAlias}"."stoppedAt", NOW()) - "${logQueryAlias}"."startedAt"))) / COUNT("${slotQueryAlias}"."id")), 0)`;
        case DatabaseTypeEnum.mysql:
            // Directly return the SQL string for MySQL, as MikroORM allows raw SQL.
            return p(`COALESCE(ROUND(SUM(TIMESTAMPDIFF(SECOND, "${logQueryAlias}"."startedAt", COALESCE("${logQueryAlias}"."stoppedAt", NOW()))) / COUNT("${slotQueryAlias}"."id")), 0)`);
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
