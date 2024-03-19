import { EntityRepository } from '@mikro-orm/knex';
import { ProductVariantSetting } from '../product-setting.entity';

export class MikroOrmProductVariantSettingRepository extends EntityRepository<ProductVariantSetting> { }
