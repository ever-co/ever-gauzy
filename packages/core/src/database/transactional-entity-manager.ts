import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import {
    DataSource,
    EntityManager,
    EntitySchema,
    ObjectLiteral,
    ObjectType,
    Repository
} from 'typeorm';

@Injectable()
export class TransactionalEntityManager {

    constructor(
        @InjectEntityManager() private entityManager: EntityManager
    ) { }

    /**
     * Retrieves the raw EntityManager instance.
     *
     * @returns The raw EntityManager instance.
     */
    get rawEntityManager(): EntityManager {
        return this.entityManager;
    }

    /**
     * Retrieves the raw connection from the EntityManager.
     *
     * @returns The raw connection from the EntityManager.
     */
    get rawConnection(): DataSource {
        return this.entityManager.connection;
    }

    /**
     * Returns a TypeORM repository for the specified target entity.
     *
     * @param target The target entity type or entity schema for which to retrieve the repository.
     * @returns The TypeORM repository for the specified target entity.
     */
    getRepository<Entity extends ObjectLiteral>(
        target: ObjectType<Entity> | EntitySchema<Entity> | string,
    ): Repository<Entity>;

    /**
     * Returns a TypeORM repository based on the provided target.
     *
     * @param target The target entity type or entity schema for which to retrieve the repository.
     * @returns The TypeORM repository for the specified target entity.
     */
    getRepository<Entity extends ObjectLiteral>(
        target?: ObjectType<Entity> | EntitySchema<Entity> | string,
    ): Repository<Entity> {
        return this.rawEntityManager.getRepository(target!);
    }
}
