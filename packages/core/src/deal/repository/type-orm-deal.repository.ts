import { Repository } from 'typeorm';
import { Deal } from '../deal.entity';

export class TypeOrmDealRepository extends Repository<Deal> { }