import { MikroOrmBaseEntityRepository } from '../../core/repository/mikro-orm-base-entity.repository';
import { Rule } from '../rule.entity';

export class MikroOrmRuleRepository extends MikroOrmBaseEntityRepository<Rule> {}
