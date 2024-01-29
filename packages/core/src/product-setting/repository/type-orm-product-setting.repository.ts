import { Repository } from 'typeorm';
import { ProductVariantSetting } from '../product-setting.entity';

export class TypeOrmProductSettingRepository extends Repository<ProductVariantSetting> { }
