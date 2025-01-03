
import { Repository } from 'typeorm';
import { EntityRepository } from '@mikro-orm/knex';
import { MultiORMEnum } from '../../../core/utils';
import { IQueryBuilder } from './iquery-builder';
import { TypeOrmQueryBuilder } from './typeorm-query-builder';
import { MikroOrmQueryBuilder } from './mikro-orm-query-builder';

type CombinedEntityRepository<Entity> = Repository<Entity> | EntityRepository<any>;

/**
 * Creates a query builder for a given repository, supporting both TypeORM and MikroORM.
 *
 * @param repository - A TypeORM `Repository` or a MikroORM `EntityRepository`.
 * @returns A `TypeOrmQueryBuilder` or `MikroOrmQueryBuilder` depending on the repository type.
 * @throws Error if the repository is neither TypeORM nor MikroORM.
 */
export function createQueryBuilder<Entity>(repository: Repository<Entity> | EntityRepository<any>, alias?: string): IQueryBuilder<Entity> {
    if (repository instanceof Repository) {
        return new TypeOrmQueryBuilder(repository);
    } else if (repository instanceof EntityRepository) {
        return new MikroOrmQueryBuilder(repository);
    }
    throw new Error('Unsupported repository orm-type');
}

/**
 * Generates a query builder specific to the chosen ORM type (TypeORM or MikroORM).
 *
 * @param repository - A repository instance, either TypeORM `Repository` or MikroORM `EntityRepository`.
 * @param ormType - Specifies the ORM type using `MultiORMEnum`, defaulting to TypeORM.
 * @returns A query builder (`TypeOrmQueryBuilder` or `MikroOrmQueryBuilder`) based on the specified ORM.
 * @throws Error if an unsupported `ormType` is provided.
 */
export function multiORMCreateQueryBuilder<Entity>(repository: CombinedEntityRepository<Entity>, ormType: MultiORMEnum = MultiORMEnum.TypeORM, alias?: string): IQueryBuilder<Entity> {
    switch (ormType) {
        case MultiORMEnum.MikroORM:
            return new MikroOrmQueryBuilder(repository as EntityRepository<any>, alias);

        case MultiORMEnum.TypeORM:
            return new TypeOrmQueryBuilder(repository as Repository<Entity>);

        default:
            throw new Error(`Unsupported orm type "${ormType}"`);
    }
}
