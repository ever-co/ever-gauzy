import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/knex';
import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { User } from '../user.entity';

@Injectable()
export class MikroOrmUserRepository extends MikroOrmBaseEntityRepository<User> {
	constructor(em: EntityManager) {
		super(em, User);
	}

    /**
     * Checks if an entity with the given email already exists in the database.
     * This method uses findOne to efficiently check existence by stopping after
     * finding the first match, rather than counting all matching records.
     *
     * @param email The email address to check for existence in the database.
     * @returns A promise that resolves to `true` if an entity with the given email exists, otherwise `false`.
     */
    async exists(email: string): Promise<boolean> {
        const entity = await super.findOne({ email }, { fields: ['id'] });
        return entity !== null;
    }
}
