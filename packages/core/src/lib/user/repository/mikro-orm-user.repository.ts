import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { User } from '../user.entity';

export class MikroOrmUserRepository extends MikroOrmBaseEntityRepository<User> {
    /**
     * Checks if an entity with the given email already exists in the database.
     * This method counts the number of entities with the specified email and
     * returns a boolean indicating whether or not an entity with that email exists.
     *
     * @param email The email address to check for existence in the database.
     * @returns A promise that resolves to `true` if an entity with the given email exists, otherwise `false`.
     */
    async exists(email: string): Promise<boolean> {
        const count = await this.count({ email });
        return count > 0;
    }
}
