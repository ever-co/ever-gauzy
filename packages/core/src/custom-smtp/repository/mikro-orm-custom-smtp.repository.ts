import { EntityRepository } from '@mikro-orm/knex';
import { CustomSmtp } from '../custom-smtp.entity';

export class MikroOrmCustomSmtpRepository extends EntityRepository<CustomSmtp> { }
