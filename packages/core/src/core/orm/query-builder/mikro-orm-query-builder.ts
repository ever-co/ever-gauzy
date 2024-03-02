import { EntityRepository, QueryBuilder, QueryOrder } from '@mikro-orm/knex';
import { IQueryBuilder } from './iquery-builder';
import { SelectQueryBuilder, EntityTarget, FindManyOptions } from 'typeorm';
import { convertTypeOrmConationAndParamsToMikroOrm } from '../utils';

export class MikroOrmQueryBuilder<Entity extends object> implements IQueryBuilder<Entity> {
    private qb: QueryBuilder<Entity>;

    private orderCriteria: Record<string, 'ASC' | 'DESC'> = {};

    private groupByFields: string[] = [];

    private havingConditions: string[] = [];
    private havingParameters: any[] = [];



    constructor(
        private readonly repo: EntityRepository<Entity>,
        alias?: string
    ) {
        this.qb = this.repo.createQueryBuilder(alias);

    }

    setFindOptions(findOptions: FindManyOptions<Entity>): this {
        const { select, where, order, skip, take, relations } = findOptions;

        if (select) {
            this.qb.select(select as any);
        }

        if (where) {
            this.qb.where(where);
        }

        if (order) {
            const orderBy = Object.entries(order).reduce((acc, [field, direction]) => {
                acc[field] = direction === 'ASC' ? QueryOrder.ASC : QueryOrder.DESC;
                return acc;
            }, {});

            this.qb.orderBy(orderBy);
        }

        if (relations) {
            this.qb.populate(relations as any);
        }

        if (skip) {
            this.qb.offset(skip);
        }

        if (take) {
            this.qb.limit(take);
        }

        return this;
    }

    select(selection: string, selectionAliasName?: string): this {
        if (selectionAliasName) {
            this.qb.select(`${selection} AS ${selectionAliasName}`);
        } else {
            this.qb.select(selection);
        }
        return this;
    }

    addSelect(selection: string, selectionAliasName?: string): this {
        if (selectionAliasName) {
            this.qb.addSelect(`${selection} AS ${selectionAliasName}`);
        } else {
            this.qb.addSelect(selection);
        }
        return this
    }

    from(entityTarget: ((qb: QueryBuilder<any>) => QueryBuilder<any>) | EntityTarget<Entity>, aliasName?: string): this {
        if (typeof entityTarget === 'function') {
            // Handle subquery function
            const subQueryFunction = entityTarget as any;
            const subQuery = subQueryFunction(this.repo.createQueryBuilder()).getKnexQuery();
            this.qb = this.repo.createQueryBuilder().from(subQuery, aliasName);
        } else {
            // Handle direct entity
            this.qb = this.repo.createQueryBuilder(aliasName);
        }
        return this;
    }

    addFrom(entityTarget: ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>) | EntityTarget<Entity>, aliasName?: string): this {
        throw new Error(`Note: This is conceptual; MikrORM typically don't support multiple FROMs like typeORM. You might use this for sub-queries or additional joins instead.`);
    }

    innerJoin(propertyPath: string, alias: string, condition?: any): this {
        this.qb.innerJoin(propertyPath, alias, condition);
        return this;
    }

    innerJoinAndSelect(propertyPath: string, alias: string, condition?: any): this {
        this.qb.innerJoinAndSelect(propertyPath, alias, condition);
        return this;
    }

    leftJoin(propertyPath: string, alias: string, condition?: any): this {
        this.qb.leftJoin(propertyPath, alias, condition);
        return this;
    }

    leftJoinAndSelect(propertyPath: string, alias: string, condition?: any): this {
        this.qb.leftJoinAndSelect(propertyPath, alias, condition);
        return this;
    }


    where(condition: string | object | ((qb: QueryBuilder<Entity>) => QueryBuilder<Entity>), parameters?: Record<string, any>): this {
        if (typeof condition === 'string') {
            const [mikroOrmCondition, mikroOrmParameters] = convertTypeOrmConationAndParamsToMikroOrm(condition, parameters);
            this.qb.where(mikroOrmCondition, mikroOrmParameters);
        } else if (typeof condition === 'function') {
            // Handle function-based subqueries
            const subQuery = condition(this.repo.createQueryBuilder());
            this.qb.where(subQuery);
        } else if (typeof condition === 'object') {
            // Handle object conditions
            this.qb.where(condition); // Mikro-ORM handles object conditions directly
        }
        return this;
    }

    andWhere(condition: string | object | ((qb: QueryBuilder<Entity>) => QueryBuilder<Entity>), parameters?: Record<string, any>): this {
        if (typeof condition === 'string') {
            const [mikroOrmCondition, mikroOrmParameters] = convertTypeOrmConationAndParamsToMikroOrm(condition, parameters);
            this.qb.andWhere(mikroOrmCondition, mikroOrmParameters);
        } else if (typeof condition === 'function') {
            // Handle function-based subqueries
            const subQuery = condition(this.repo.createQueryBuilder());
            this.qb.andWhere(subQuery);
        } else if (typeof condition === 'object') {
            // Handle object conditions
            this.qb.andWhere(condition); // Mikro-ORM handles object conditions directly
        }
        return this;
    }

    orWhere(condition: string | object | ((qb: QueryBuilder<Entity>) => QueryBuilder<Entity>), parameters?: Record<string, any>): this {
        if (typeof condition === 'string') {
            const [mikroOrmCondition, mikroOrmParameters] = convertTypeOrmConationAndParamsToMikroOrm(condition, parameters);
            this.qb.orWhere(mikroOrmCondition, mikroOrmParameters);
        } else if (typeof condition === 'function') {
            // Handle function-based subqueries
            const subQuery = condition(this.repo.createQueryBuilder());
            this.qb.orWhere(subQuery);
        } else if (typeof condition === 'object') {
            // Handle object conditions
            this.qb.orWhere(condition); // Mikro-ORM handles object conditions directly
        }
        return this;
    }

    having(condition: string, parameters?: any[]): this {
        this.havingConditions = [condition]; // Reset the having conditions
        if (parameters) {
            this.havingParameters.push(...parameters);
        }
        this.applyHavingConditions();
        return this;
    }

    andHaving(condition: string, parameters?: any[]): this {
        this.havingConditions.push(condition); // Add to existing having conditions
        if (parameters) {
            this.havingParameters.push(...parameters);
        }
        this.applyHavingConditions();
        return this;
    }

    orHaving(condition: string, parameters?: any[]): this {
        // Mikro-ORM does not directly support 'orHaving', so we need to handle it manually.
        // We achieve this by wrapping existing conditions in parentheses and adding the new condition with 'OR'.
        if (this.havingConditions.length > 0) {
            const existingConditions = `(${this.havingConditions.join(' AND ')})`;
            this.havingConditions = [existingConditions, `(${condition})`]; // Combine with OR
        } else {
            this.havingConditions = [`(${condition})`]; // Just in case orHaving is called first
        }
        if (parameters) {
            this.havingParameters.push(...parameters);
        }
        this.applyHavingConditions();
        return this;
    }

    private applyHavingConditions(): void {
        if (this.havingConditions.length > 0) {
            // Join all having conditions with AND and apply them to the query builder
            const combinedConditions = this.havingConditions.join(' AND ');
            this.qb.having(combinedConditions, ...this.havingParameters);
        }
    }

    groupBy(field: string): this {
        this.groupByFields = [field]; // Reset and set new group by
        this.qb.groupBy(field);
        return this
    }

    addGroupBy(field: string): this {
        if (!this.groupByFields.includes(field)) {
            this.groupByFields.push(field);
            // Apply all group by fields again
            this.qb.groupBy(this.groupByFields.join(', '));
        }
        return this;
    }

    orderBy(field: string, order: 'ASC' | 'DESC' = 'ASC'): this {
        this.orderCriteria = { [field]: order }; // Reset and set new order criteria
        this.qb.orderBy(this.orderCriteria);
        return this;
    }

    addOrderBy(field: string, order: 'ASC' | 'DESC' = 'ASC'): this {
        this.orderCriteria[field] = order; // Add to existing order criteria
        this.qb.orderBy(this.orderCriteria); // Re-apply all order criteria
        return this;
    }


    limit(limit?: number): this {
        this.qb.limit(limit);
        return this;
    }

    offset(offset?: number): this {
        this.qb.offset(offset);
        return this;
    }

    take(take?: number): this {
        this.qb.limit(take);
        return this;
    }

    skip(skip?: number): this {
        this.qb.offset(skip);
        return this;
    }



    async getMany(): Promise<Entity[]> {
        return this.qb.getResultList();
    }

    async getOne(): Promise<Entity | null> {
        return this.qb.getSingleResult();
    }
}
