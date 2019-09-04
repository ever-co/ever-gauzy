import { Controller, HttpStatus, Get, Query } from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { IPagination } from '../core';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';
import { EmployeeRecurringExpenseService } from './employee-recurring-expense.service';

@ApiUseTags('EmployeeRecurringExpense')
@Controller()
export class EmployeeRecurringExpenseController extends CrudController<EmployeeRecurringExpense> {
    constructor(private readonly employeeRecurringExpenseService: EmployeeRecurringExpenseService) {
        super(employeeRecurringExpenseService);
    }

    @ApiOperation({ title: 'Find all employee recurring expense.' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Found employee recurring expense', type: EmployeeRecurringExpense })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
    @Get()
    async findAllEmployees(@Query('data') data: string): Promise<IPagination<EmployeeRecurringExpense>> {
        const { relations, findInput } = JSON.parse(data);

        return this.employeeRecurringExpenseService.findAll({ where: findInput, relations });
    }
}
