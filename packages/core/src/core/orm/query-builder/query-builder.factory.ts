
import { Repository } from 'typeorm';
import { EntityRepository } from '@mikro-orm/knex';
import { IQueryBuilder } from './iquery-builder';
import { TypeOrmQueryBuilder } from './typeorm-query-builder';
import { MikroOrmQueryBuilder } from './mikro-orm-query-builder';

export function createQueryBuilder<T>(repository: Repository<T> | EntityRepository<any>): IQueryBuilder<T> {
    if (repository instanceof Repository) {
        return new TypeOrmQueryBuilder(repository);
    } else if (repository instanceof EntityRepository) {
        return new MikroOrmQueryBuilder(repository);
    }
    throw new Error('Unsupported repository orm-type');
}
