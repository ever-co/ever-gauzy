import { Controller, HttpStatus, Get, Query } from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EmployeeSettingService } from './employee-setting.service';
import { EmployeeSetting } from './employee-setting.entity';
import { CrudController } from '../core/crud/crud.controller';
import { IPagination } from '../core';

@ApiUseTags('EmployeeSetting')
@Controller()
export class EmployeeSettingController extends CrudController<EmployeeSetting> {
    constructor(private readonly employeeSettingService: EmployeeSettingService) {
        super(employeeSettingService);
    }

    @ApiOperation({ title: 'Find all employee settings.' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Found employee settings', type: EmployeeSetting })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
    @Get()
    async findAllEmployees(@Query('data') data: string): Promise<IPagination<EmployeeSetting>> {
        const { relations, findInput } = JSON.parse(data);

        return this.employeeSettingService.findAll({ where: findInput, relations });
    }
}
