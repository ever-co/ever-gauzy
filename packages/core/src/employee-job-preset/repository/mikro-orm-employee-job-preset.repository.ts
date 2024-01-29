import { EntityRepository } from '@mikro-orm/core';
import { JobPreset } from '../job-preset.entity';

export class MikroOrmEmployeeJobPresetRepository extends EntityRepository<JobPreset> { }
