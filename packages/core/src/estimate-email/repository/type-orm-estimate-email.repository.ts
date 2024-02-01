import { Repository } from 'typeorm';
import { EstimateEmail } from '../estimate-email.entity';

export class TypeOrmEstimateEmailRepository extends Repository<EstimateEmail> { }