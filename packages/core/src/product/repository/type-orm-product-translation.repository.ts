import { Repository } from 'typeorm';
import { ProductTranslation } from '../product-translation.entity';

export class TypeOrmProductTranslationRepository extends Repository<ProductTranslation> { }
