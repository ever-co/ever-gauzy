import { Controller, HttpStatus, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EmployeeStatisticsService } from './employee-statistics.service';
import { EmployeeStatistics } from '@gauzy/models';

@Controller()
export class EmployeeStatisticsController {
    constructor(private employeeStatisticsService: EmployeeStatisticsService) { }

    @ApiOperation({ summary: 'Find by id' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Found one record' })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
    @Get(':id')
    async findAllByEmloyeeId(@Param('id') id: string, @Query('data') data?: string): Promise<EmployeeStatistics> {
        const { findInput } = JSON.parse(data);
        return this.employeeStatisticsService.getStatisticsByEmployeeId(id, findInput);
    }
}
