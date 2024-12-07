/**
 * Converts TypeORM-style where conditions and parameters to Mikro-ORM-style.
 * @param whereCondition The TypeORM-style where condition string.
 * @param parameters The TypeORM-style parameters object.
 * @returns An array where the first element is the converted where condition string
 * and the second element is the array of parameters for Mikro-ORM.
 */
export function convertTypeOrmConationAndParamsToMikroOrm(whereCondition: string, parameters: Record<string, any>): [string, any[]] {
    const mikroOrmParameters: any[] = [];
    const mikroOrmCondition = whereCondition.replace(/:(\w+)/g, (match, paramName) => {
        // Check if the parameter exists; if not, throw an error or handle as needed
        if (!(paramName in parameters)) {
            throw new Error(`Parameter "${paramName}" not found.`);
        }
        mikroOrmParameters.push(parameters[paramName]);
        return '?'; // Replace named parameters with positional parameters
    });
    return [mikroOrmCondition, mikroOrmParameters];
}


export function getConationFromQuery(query) {
    const whereIndex = query.toUpperCase().indexOf("WHERE");
    if (whereIndex !== -1) {
        const conditions = query
            .substring(whereIndex + "WHERE".length)
            .trim()
            .replace(/\$\d+/g, '?'); // Extract where condition from query;
        return conditions;
    } else {
        return null;
    }
}
