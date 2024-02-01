import { EntityRepository } from '@mikro-orm/core';
import { EstimateEmail } from '../estimate-email.entity';

export class MikroOrmEstimateEmailRepository extends EntityRepository<EstimateEmail> { }