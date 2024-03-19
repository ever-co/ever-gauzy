import { EntityRepository } from '@mikro-orm/knex';
import { JobPreset } from '../job-preset.entity';

export class MikroOrmJobPresetRepository extends EntityRepository<JobPreset> { }
