import { Repository } from 'typeorm';
import { ProductVariant } from '../product-variant.entity';

export class TypeOrmProductVariantRepository extends Repository<ProductVariant> { }