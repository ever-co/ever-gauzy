import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { JobPreset } from '../job-preset.entity';

export class MikroOrmJobPresetRepository extends MikroOrmBaseEntityRepository<JobPreset> { }
