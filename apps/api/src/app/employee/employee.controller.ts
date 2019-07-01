import { Controller, HttpStatus, Get, Query } from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EmployeeService } from './employee.service';
import { Employee } from './employee.entity';
import { CrudController } from '../core/crud/crud.controller';
import { IPagination } from '../core';

@ApiUseTags('Employee')
@Controller()
export class EmployeeController extends CrudController<Employee> {
    constructor(private readonly employeeService: EmployeeService) {
        super(employeeService);
    }

    @ApiOperation({ title: 'Find all employees.' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Found employees', type: Employee })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
    @Get()
    async findAllEmployees(@Query('data') data: string): Promise<IPagination<Employee>> {
        const {relations, findInput} = JSON.parse(data);
    
        return this.employeeService.findAll({ where: findInput,  relations });
    }
}