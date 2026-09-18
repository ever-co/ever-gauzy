import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { ContactCredential } from '../contact-credential.entity';

/**
 * MikroORM repository of ContactCredential. The base class supplies the entity-manager-backed
 * operations the service uses when the installation runs on MikroORM instead of TypeORM.
 */
export class MikroOrmContactCredentialRepository extends MikroOrmBaseEntityRepository<ContactCredential> {}
