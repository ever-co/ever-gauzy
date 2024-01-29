import { Repository } from 'typeorm';
import { ProductVariantSetting } from '../product-setting.entity';

export class TypeOrmProductVariantSettingRepository extends Repository<ProductVariantSetting> { }
