import { Repository } from 'typeorm';
import { ProductVariantPrice } from '../product-variant-price.entity';

export class TypeOrmProductVariantPriceRepository extends Repository<ProductVariantPrice> { }