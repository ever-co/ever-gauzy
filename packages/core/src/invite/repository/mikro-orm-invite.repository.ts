import { EntityRepository } from '@mikro-orm/core';
import { Invite } from '../invite.entity';

export class MikroOrmInviteRepository extends EntityRepository<Invite> { }