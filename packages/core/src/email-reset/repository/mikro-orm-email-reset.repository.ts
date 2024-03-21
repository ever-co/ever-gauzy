import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { EmailReset } from '../email-reset.entity';

export class MikroOrmEmailResetRepository extends MikroOrmBaseEntityRepository<EmailReset> { }
