import { EntityRepository } from '@mikro-orm/knex';
import { Invite } from '../invite.entity';

export class MikroOrmInviteRepository extends EntityRepository<Invite> { }
