import { EntityRepository } from '@mikro-orm/core';
import { ProductVariantSetting } from '../product-setting.entity';

export class MikroOrmProductVariantSettingRepository extends EntityRepository<ProductVariantSetting> { }
