import { QueryBuilder } from '@mikro-orm/knex';
import { EntityTarget, FindManyOptions, SelectQueryBuilder } from 'typeorm';

export interface IQueryBuilder<Entity> {
	alias: string;
	setQueryBuilder(qb: SelectQueryBuilder<Entity> | QueryBuilder<any>): this;
	getQueryBuilder(): SelectQueryBuilder<Entity> | QueryBuilder<any>;
	clone(): this;
	subQuery(): IQueryBuilder<Entity>;
	setFindOptions(findOptions: FindManyOptions<Entity>): this;
	select(selection: string, selectionAliasName?: string): this;
	addSelect(selection: string, selectionAliasName?: string): this;
	from(
		entityTarget: EntityTarget<Entity> | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
		aliasName?: string
	): this;
	addFrom(
		entityTarget: EntityTarget<Entity> | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
		aliasName?: string
	): this;
	innerJoin(relation: string, alias: string, condition?: string): this;
	innerJoinAndSelect(relation: string, alias: string, condition?: string): this;
	leftJoin(relation: string, alias: string, condition?: string): this;
	leftJoinAndSelect(relation: string, alias: string, condition?: string): this;
	where(condition: string | object, parameters?: object): this;
	andWhere(condition: string | object, parameters?: object): this;
	orWhere(condition: string | object, parameters?: object): this;
	having(having: string, parameters?: object): this;
	andHaving(having: string, parameters?: object): this;
	orHaving(having: string, parameters?: object): this;
	groupBy(groupBy: string): this;
	addGroupBy(groupBy: string): this;
	orderBy(sort: string, order?: 'ASC' | 'DESC', nulls?: 'NULLS FIRST' | 'NULLS LAST'): this;
	addOrderBy(sort: string, order?: 'ASC' | 'DESC', nulls?: 'NULLS FIRST' | 'NULLS LAST'): this;
	limit(limit?: number): this;
	offset(offset?: number): this;
	take(take?: number): this;
	skip(skip?: number): this;
	getParameters(): any;
	getQuery(): string;
	getSql(): string;
	getCount(): Promise<number>;
	getRawMany(): Promise<any[]>;
	getMany(): Promise<Entity[]>;
	getOne(): Promise<Entity | null>;
	getRawOne(): Promise<any>;
	getManyAndCount(): Promise<[Entity[], number]>;
}
