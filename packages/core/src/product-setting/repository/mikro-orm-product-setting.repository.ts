import { EntityRepository } from '@mikro-orm/core';
import { ProductVariantSetting } from '../product-setting.entity';

export class MikroOrmProductSettingRepository extends EntityRepository<ProductVariantSetting> { }
