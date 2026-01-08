import { randomBytes } from "crypto";
import { FindOptionsRelations, FindOptionsSelect } from "typeorm";
import { isEmpty, isNotEmpty } from "@gauzy/utils";
import { IShareRule } from "@gauzy/contracts";


/**
 * Builds the select for the shared entity.
 *
 * @param rules - The share rules for the shared entity.
 * @returns The select for the shared entity.
 */
export function buildSharedEntitySelect(rules: IShareRule): FindOptionsSelect<any> {
    const select: FindOptionsSelect<any> = {
        id: true // Always include the primary key for TypeORM to work correctly
    };

    // Add the fields to the select
    for (const field of rules.fields) {
        select[field] = true;
    }

    // Add the relations to the select
    if (isNotEmpty(rules.relations)) {
        for (const [relation, subRules] of Object.entries(rules.relations)) {
            select[relation] = buildSharedEntitySelect(subRules as IShareRule);
        }
    }

    // Return the select
    return select;
}

/**
 * Builds the relations for the shared entity.
 *
 * @param rules - The share rules for the shared entity.
 * @returns The relations for the shared entity.
 */
export function buildSharedEntityRelations(rules: IShareRule): FindOptionsRelations<any> {
    if (isEmpty(rules.relations)) return {};

    const relations: FindOptionsRelations<any> = {};

    // Add the relations to the relations
    for (const [relation, subRules] of Object.entries(rules.relations)) {
        relations[relation] = isEmpty(subRules) ? true : buildSharedEntityRelations(subRules as IShareRule);
    }

    // Return the relations
    return relations;
}

/**
 * Filters the entity based on the share rules.
 *
 * @param entity - The entity to filter.
 * @param rules - The share rules for the shared entity.
 * @returns The filtered entity.
 */
export function filterSharedEntity(entity: any, rules: IShareRule): any {
    const result: any = {};

    for (const field of rules.fields) {
        result[field] = entity[field];
    }

    if (rules.relations) {
        for (const [relation, subRules] of Object.entries(rules.relations)) {
            if (!entity[relation]) continue;

            if (Array.isArray(entity[relation])) {
                result[relation] = entity[relation].map(item =>
                    filterSharedEntity(item, subRules as IShareRule)
                );
            } else {
                result[relation] = filterSharedEntity(entity[relation], subRules as IShareRule);
            }
        }
    }

    // Return the result
        return result;
}

/**
 * Generates a unique token for the shared entity.
 *
 * @returns A string of 32 characters.
 */
export function generateSharedEntityToken(): string {
    return randomBytes(16).toString('hex');
}
