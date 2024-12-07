import { EntityRepository, QueryBuilder, QueryOrder } from '@mikro-orm/knex';
import { IQueryBuilder } from './iquery-builder';
import { Brackets, EntityTarget, FindManyOptions } from 'typeorm';
import { convertTypeOrmConationAndParamsToMikroOrm, getConationFromQuery } from '../utils';

export class MikroOrmQueryBuilder<Entity extends object> implements IQueryBuilder<Entity> {

    private qb: QueryBuilder<Entity>;
    private orderCriteria: Record<string, 'ASC' | 'DESC'> = {};
    private groupByFields: string[] = [];
    private havingConditions: string[] = [];
    private havingParameters: any[] = [];

    get alias() {
        return this.qb.alias;
    }

    constructor(
        private readonly repository: EntityRepository<Entity>,
        public readonly queryAlias?: string
    ) {
        // this.qb = this.repository.qb(queryAlias);
        this.qb = this.repository.createQueryBuilder(queryAlias);
    }

    setQueryBuilder(qb: QueryBuilder<Entity>) {
        this.qb = qb;
        return this;
    }

    getQueryBuilder() {
        return this.qb;
    }

    clone(): this {
        const qb = this.qb.clone();
        const cloneQb: any = new MikroOrmQueryBuilder(this.repository);
        cloneQb.setQueryBuilder(qb);
        return this;
    }

    subQuery() {
        //  console.log('sq_alisa', this.aliasNo);
        const subQb: any = new MikroOrmQueryBuilder(this.repository);
        const qb = subQb as IQueryBuilder<Entity>;
        return qb;
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
            this.applyRelationsToQueryBuilder(this.qb, relations as any);
            //    this.qb.populate(relations as any);
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

    distinct(isDistinct?: boolean): this {
        this.qb.distinct()
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
            const subQuery = subQueryFunction(this.subQuery()).getKnexQuery();
            this.qb = this.repository.createQueryBuilder().from(subQuery, aliasName);
        } else {
            // Handle direct entity
            this.qb = this.repository.createQueryBuilder(aliasName) as QueryBuilder<Entity>;
        }
        return this;
    }

    addFrom(_entityTarget: ((qb: QueryBuilder<any>) => QueryBuilder<any>) | EntityTarget<Entity>, _aliasName?: string): this {
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

    private handleWhereSubQuery(conditionFunction, whereFunction: 'where' | 'orWhere' | 'andWhere' = 'where') {
        let subQuery = this.subQuery();
        let updatedQb = conditionFunction(subQuery as any);

        if (updatedQb === undefined) {
            updatedQb = subQuery;
        }

        if (typeof updatedQb === 'string') {
            switch (whereFunction) {
                case 'orWhere':
                    this.orWhere(updatedQb)
                    break;
                case 'andWhere':
                    this.andWhere(updatedQb)
                    break;
                default:
                    this.where(updatedQb)
                    break;
            }
        } else {
            const sqlQuery = updatedQb.getSql();
            const params = updatedQb.getParameters();
            const whereString = getConationFromQuery(sqlQuery);
            if (whereString) {
                switch (whereFunction) {
                    case 'orWhere':
                        this.orWhere(whereString, params)
                        break;
                    case 'andWhere':
                        this.andWhere(whereString, params)
                        break;
                    default:
                        this.where(whereString, params)
                        break;
                }
            }
        }
    }

    private handleWhereBracketsSubQuery(conditionFunction) {

        let subQuery = this.subQuery();
        let updatedQb = conditionFunction.whereFactory(subQuery as any)

        if (updatedQb === undefined) {
            updatedQb = subQuery;
        }

        const sqlQuery = updatedQb.getSql();
        const params = updatedQb.getParameters();
        const whereString = getConationFromQuery(sqlQuery);

        if (whereString) {
            return [whereString, params];
        } else {
            return [];
        }

    }

    where(condition: string | object | ((qb: IQueryBuilder<Entity>) => IQueryBuilder<Entity>), parameters?: Record<string, any>): this {
        if (typeof condition === 'string') {
            const [mikroOrmCondition, mikroOrmParameters] = convertTypeOrmConationAndParamsToMikroOrm(condition, parameters);
            this.qb.where(mikroOrmCondition, mikroOrmParameters);
        } else if (typeof condition === 'function') {
            this.handleWhereSubQuery(condition, 'where');
        } else if (condition instanceof Brackets) {
            const [mikroOrmCondition, mikroOrmParameters] = this.handleWhereBracketsSubQuery(condition);
            if (mikroOrmCondition) {
                this.qb.where(mikroOrmCondition, mikroOrmParameters);
            }
        } else if (typeof condition === 'object') {
            // Handle object conditions
            this.qb.where(condition);
        }
        return this;
    }

    andWhere(condition: string | object | ((qb: IQueryBuilder<Entity>) => IQueryBuilder<Entity>), parameters?: Record<string, any>): this {
        if (typeof condition === 'string') {
            const [mikroOrmCondition, mikroOrmParameters] = convertTypeOrmConationAndParamsToMikroOrm(condition, parameters);
            this.qb.andWhere(mikroOrmCondition, mikroOrmParameters);
        } else if (typeof condition === 'function') {
            this.handleWhereSubQuery(condition, 'andWhere');
        } else if (condition instanceof Brackets) {
            const [mikroOrmCondition, mikroOrmParameters] = this.handleWhereBracketsSubQuery(condition);
            if (mikroOrmCondition) {
                this.qb.andWhere(mikroOrmCondition, mikroOrmParameters);
            }
        } else if (typeof condition === 'object') {
            // Handle object conditions
            this.qb.andWhere(condition);
        }
        return this;
    }

    orWhere(condition: string | object | ((qb: IQueryBuilder<Entity>) => IQueryBuilder<Entity>), parameters?: Record<string, any>): this {
        if (typeof condition === 'string') {
            const [mikroOrmCondition, mikroOrmParameters] = convertTypeOrmConationAndParamsToMikroOrm(condition, parameters);
            this.qb.orWhere(mikroOrmCondition, mikroOrmParameters);
        } else if (typeof condition === 'function') {
            this.handleWhereSubQuery(condition, 'orWhere');
        } else if (condition instanceof Brackets) {
            const [mikroOrmCondition, mikroOrmParameters] = this.handleWhereBracketsSubQuery(condition);
            if (mikroOrmCondition) {
                this.qb.orWhere(mikroOrmCondition, mikroOrmParameters);
            }
        } else if (typeof condition === 'object') {
            // Handle object conditions
            this.qb.orWhere(condition);
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

    getQuery(): string {
        return this.qb.getQuery();
    }

    getSql(): string {
        return this.qb.getQuery();
    }

    getParameters(): any {
        return this.qb.getParams();
    }

    getCount(): Promise<number> {
        return this.qb.getCount();
    }

    getRawMany(): Promise<any[]> {
        return this.qb.execute('all', false);
    }

    getMany(): Promise<Entity[]> {
        return this.qb.execute('all', true);
    }

    getOne(): Promise<Entity | null> {
        return this.qb.execute('get', true);
    }

    getRawOne(): Promise<any> {
        return this.qb.execute('get', false);
    }

    getManyAndCount(): Promise<[Entity[], number]> {
        return this.qb.getResultAndCount();
    }

    private applyRelationsToQueryBuilder<Entity>(
        qb: QueryBuilder<any>,
        relations: string[]
    ) {
        // A set to keep track of joined paths to avoid duplicates
        const joinedPaths = new Set<string>();

        relations.forEach((relationPath) => {
            // Split the path to get individual relations
            const parts = relationPath.split('.');
            let currentPath = '';

            parts.forEach((part, index) => {
                // Build the path incrementally to support nested relations
                currentPath += (index ? '.' : '') + part;

                // Avoid joining the same path more than once
                if (!joinedPaths.has(currentPath)) {
                    const [parentAlias, relation] = index === 0 ? [qb.alias, part] : currentPath.split('.').slice(-2);
                    const alias = currentPath.replace(/\./g, '_'); // Replace dots with underscores to create a unique alias

                    console.log('leftJoinAndSelect', `${parentAlias}.${relation}`, alias);
                    // Apply the join; you might choose between leftJoinAndSelect or innerJoinAndSelect based on your needs
                    qb.leftJoinAndSelect(`${parentAlias}.${relation}`, alias);

                    // Mark this path as joined
                    joinedPaths.add(currentPath);
                }
            });
        });
    }
}
