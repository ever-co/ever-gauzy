import { EntityRepository } from '@mikro-orm/core';
import { Wakatime } from '../wakatime.entity';

export class MikroOrmWakatimeRepository extends EntityRepository<Wakatime> { }
