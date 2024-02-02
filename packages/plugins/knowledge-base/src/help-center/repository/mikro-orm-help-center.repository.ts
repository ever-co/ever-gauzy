import { EntityRepository } from '@mikro-orm/core';
import { HelpCenter } from '../help-center.entity';

export class MikroOrmHelpCenterRepository extends EntityRepository<HelpCenter> { }