import { Repository } from 'typeorm';
import { Merchant } from '../merchant.entity';

export class TypeOrmMerchantRepository extends Repository<Merchant> { }