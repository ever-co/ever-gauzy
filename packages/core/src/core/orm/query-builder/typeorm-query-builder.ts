
import { EntityTarget, FindManyOptions, Repository, SelectQueryBuilder } from 'typeorm';
import { IQueryBuilder } from './iquery-builder';

export class TypeOrmQueryBuilder<T extends Object> implements IQueryBuilder<T> {

    private qb: SelectQueryBuilder<T>;

    constructor(private readonly repo: Repository<T>) {
        this.qb = this.repo.createQueryBuilder();
    }

    setFindOptions(findOptions: FindManyOptions<T>) {
        this.qb.setFindOptions(findOptions);
        return this;
    }

    select(selection: string, selectionAliasName?: string): this {
        this.qb.select(selection, selectionAliasName);
        return this;
    }

    addSelect(selection: string, selectionAliasName?: string): this {
        this.qb.addSelect(selection, selectionAliasName);
        return this;
    }

    from(entityTarget: EntityTarget<T> | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>), aliasName?: string): this {
        this.qb.from(entityTarget, aliasName);
        return this;
    }

    addFrom(entityTarget: EntityTarget<T> | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>), aliasName?: string): this {
        this.qb.addFrom(entityTarget, aliasName);
        return this;
    }

    innerJoin(relation: string, alias: string, condition?: string): this {
        this.qb.innerJoin(relation, alias, condition);
        return this;
    }

    innerJoinAndSelect(relation: string, alias: string, condition?: string): this {
        this.qb.innerJoinAndSelect(relation, alias, condition);
        return this;
    }

    leftJoin(relation: string, alias: string, condition?: string): this {
        this.qb.leftJoin(relation, alias, condition);
        return this;
    }

    leftJoinAndSelect(relation: string, alias: string, condition?: string): this {
        this.qb.leftJoinAndSelect(relation, alias, condition);
        return this;
    }

    where(condition: string | object, parameters?: object): this {
        this.qb.where(condition, parameters);
        return this;
    }

    andWhere(condition: string | object, parameters?: object): this {
        this.qb.andWhere(condition, parameters);
        return this;
    }

    orWhere(condition: string | object, parameters?: object): this {
        this.qb.orWhere(condition, parameters);
        return this;
    }

    having(having: string, parameters?: object): this {
        this.qb.having(having, parameters);
        return this;
    };

    andHaving(having: string, parameters?: object): this {
        this.qb.andHaving(having, parameters);
        return this;
    };

    orHaving(having: string, parameters?: object): this {
        this.qb.orHaving(having, parameters);
        return this;
    };

    groupBy(groupBy: string): this {
        this.qb.groupBy(groupBy);
        return this;
    };

    addGroupBy(groupBy: string): this {
        this.qb.addGroupBy(groupBy);
        return this;
    };

    orderBy(sort: string, order?: "ASC" | "DESC", nulls?: "NULLS FIRST" | "NULLS LAST"): this {
        this.qb.orderBy(sort, order, nulls);
        return this;
    };

    addOrderBy(sort: string, order?: "ASC" | "DESC", nulls?: "NULLS FIRST" | "NULLS LAST"): this {
        this.qb.addOrderBy(sort, order, nulls);
        return this;
    };

    limit(limit?: number): this {
        this.qb.limit(limit);
        return this;
    };

    offset(offset?: number): this {
        this.qb.offset(offset);
        return this;
    };

    take(take?: number): this {
        this.qb.take(take);
        return this;
    };

    skip(skip?: number): this {
        this.qb.skip(skip);
        return this;
    };

    getManyAndCount() {
        return this.qb.getManyAndCount();
    }

    getCount() {
        return this.qb.getCount();
    }

    getMany(): Promise<any[]> {
        return this.qb.getMany();
    }

    getRawMany(): Promise<any[]> {
        return this.qb.getRawMany();
    }

    getOne(): Promise<any> {
        return this.qb.getOne();
    }

    getRawOne(): Promise<any> {
        return this.qb.getRawOne();
    }


}
