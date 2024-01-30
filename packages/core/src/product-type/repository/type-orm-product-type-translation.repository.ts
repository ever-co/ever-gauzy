import { Repository } from 'typeorm';
import { ProductTypeTranslation } from '../product-type-translation.entity';

export class TypeOrmProductTypeTranslationRepository extends Repository<ProductTypeTranslation> { }
