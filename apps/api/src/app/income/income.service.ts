import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Income } from './income.entity';
import { CrudService } from '../core/crud/crud.service';

@Injectable()
export class IncomeService extends CrudService<Income> {
  constructor(@InjectRepository(Income) private readonly incomeRepository: Repository<Income>) {
    super(incomeRepository);
  }
}
