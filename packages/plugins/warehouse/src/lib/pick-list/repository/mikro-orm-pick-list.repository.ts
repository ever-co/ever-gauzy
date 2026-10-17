import { Injectable } from '@nestjs/common';
import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PickList } from '../pick-list.entity';

@Injectable()
export class MikroOrmPickListRepository extends MikroOrmBaseEntityRepository<PickList> {}
