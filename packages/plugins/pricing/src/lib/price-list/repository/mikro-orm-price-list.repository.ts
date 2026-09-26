import { MikroOrmBaseEntityRepository } from '@gauzy/core';
import { PriceList } from '../price-list.entity';

export class MikroOrmPriceListRepository extends MikroOrmBaseEntityRepository<PriceList> {}
