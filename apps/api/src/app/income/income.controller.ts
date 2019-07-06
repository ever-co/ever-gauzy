import { Controller, HttpStatus, Post, Body } from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IncomeService } from './income.service';
import { Income } from './income.entity';
import { CrudController } from '../core/crud/crud.controller';
import { IncomeCreateInput as IIncomeCreateInput } from '@gauzy/models';
import { CommandBus } from '@nestjs/cqrs';
import { IncomeCreateCommand } from './commands/income.create.command';

@ApiUseTags('Income')
@Controller()
export class IncomeController extends CrudController<Income> {
  constructor(private readonly incomeService: IncomeService,
    private readonly commandBus: CommandBus) {
    super(incomeService);
  }

  @ApiOperation({ title: 'Create new record' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'The record has been successfully created.' /*, type: T*/ })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid input, The response body may contain clues as to what went wrong',
  })
  @Post('/create')
  async create1(@Body() entity: IIncomeCreateInput, ...options: any[]): Promise<Income> {
    console.log(entity)
    return this.commandBus.execute(
      new IncomeCreateCommand(entity)
    );
  }
}
