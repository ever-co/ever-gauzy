import { Repository } from 'typeorm';
import { Product } from '../product.entity';

export class TypeOrmProductRepository extends Repository<Product> { }