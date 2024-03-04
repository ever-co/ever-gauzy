
import { Repository } from 'typeorm';
import { EntityRepository } from '@mikro-orm/knex';
import { IQueryBuilder } from './iquery-builder';
import { TypeOrmQueryBuilder } from './typeorm-query-builder';
import { MikroOrmQueryBuilder } from './mikro-orm-query-builder';
import { MultiORMEnum } from 'core/utils';

export function createQueryBuilder<Entity>(repository: Repository<Entity> | EntityRepository<any>): IQueryBuilder<Entity> {
    if (repository instanceof Repository) {
        return new TypeOrmQueryBuilder(repository);
    } else if (repository instanceof EntityRepository) {
        return new MikroOrmQueryBuilder(repository);
    }
    throw new Error('Unsupported repository orm-type');
}


export function multiORMCreateQueryBuilder<Entity>(repository: Repository<Entity> | EntityRepository<any>, ormType: MultiORMEnum = MultiORMEnum.TypeORM): IQueryBuilder<Entity> {
    switch (ormType) {
        case MultiORMEnum.MikroORM:
            return new MikroOrmQueryBuilder(repository as EntityRepository<any>);

        case MultiORMEnum.TypeORM:
            return new MikroOrmQueryBuilder(repository as EntityRepository<any>);

        default:
            throw new Error(`Unsupported orm type "${ormType}"`);
    }
}
