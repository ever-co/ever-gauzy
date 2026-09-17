import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PackSlip } from '../pack-slip.entity';

@Injectable()
export class MikroOrmPackSlipRepository extends MikroOrmBaseEntityRepository<PackSlip> {}
