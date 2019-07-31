import { Controller, HttpStatus, Get, Query } from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EmployeeSettingsService } from './employee-settings.service';
import { EmployeeSettings } from './employee-settings.entity';
import { CrudController } from '../core/crud/crud.controller';
import { IPagination } from '../core';

@ApiUseTags('EmployeeSettings')
@Controller()
export class EmployeeSettingsController extends CrudController<EmployeeSettings> {
    constructor(private readonly employeeSettingsService: EmployeeSettingsService) {
        super(employeeSettingsService);
    }

    @ApiOperation({ title: 'Find all employee settings.' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Found employee settings', type: EmployeeSettings })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
    @Get()
    async findAllEmployees(@Query('data') data: string): Promise<IPagination<EmployeeSettings>> {
        const { relations, findInput } = JSON.parse(data);

        return this.employeeSettingsService.findAll({ where: findInput, relations });
    }
}
