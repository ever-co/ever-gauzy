import { Repository } from 'typeorm';
import { ProductOption } from '../product-option.entity';

export class TypeOrmProductOptionRepository extends Repository<ProductOption> { }