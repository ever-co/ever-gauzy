import { EntityRepository } from '@mikro-orm/knex';
import { HelpCenter } from '../help-center.entity';

export class MikroOrmHelpCenterRepository extends EntityRepository<HelpCenter> { }
