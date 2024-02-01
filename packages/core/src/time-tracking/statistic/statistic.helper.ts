import { DatabaseTypeEnum } from "@gauzy/config";

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
