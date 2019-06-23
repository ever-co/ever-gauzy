import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { IncomeService } from './income.service';
import { Income } from './income.entity';
import { CrudController } from '../core/crud/crud.controller';

@ApiUseTags('Income')
@Controller()
export class IncomeController extends CrudController<Income> {
  constructor(private readonly incomeService: IncomeService) {
    super(incomeService);
  }
}
