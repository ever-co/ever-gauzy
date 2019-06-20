import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { IncomeService } from './income.service';

@ApiUseTags('Income')
@Controller()
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {
  }
}
