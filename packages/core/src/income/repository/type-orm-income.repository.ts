import { Repository } from 'typeorm';
import { Income } from '../income.entity';

export class TypeOrmIncomeRepository extends Repository<Income> { }