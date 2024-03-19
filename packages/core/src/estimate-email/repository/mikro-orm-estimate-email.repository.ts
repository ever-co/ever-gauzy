import { EntityRepository } from '@mikro-orm/knex';
import { EstimateEmail } from '../estimate-email.entity';

export class MikroOrmEstimateEmailRepository extends EntityRepository<EstimateEmail> { }
