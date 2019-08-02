import { Controller, HttpStatus, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EmployeeStatisticsService } from './employee-statistics.service';

@Controller()
export class EmployeeStatisticsController {
    constructor(private employeeStatisticsService: EmployeeStatisticsService) { }

    // @ApiOperation({ title: 'Find by id' })
    // @ApiResponse({ status: HttpStatus.OK, description: 'Found one record' })
    // @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
    // @Get(':id')
    // async findAll(@Param('id') id: string, @Query('data') data?: string): Promise<any> { // add model
    //     const { findInput } = JSON.parse(data);
    //     const result = await this.employeeStatisticsService.getStatisticsByEmployeeId(id, findInput);
    //     console.log('======================================================')
    //     console.log(result)
    //     return this.employeeStatisticsService.getStatisticsByEmployeeId(id, findInput);
    // }

    @ApiOperation({ title: 'Find by id' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Found one record' })
    @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
    @Get(':id')
    async findAllByEmloyeeId(@Param('id') id: string, @Query('data') data?: string): Promise<any> { // add model
        const { findInput } = JSON.parse(data);
        const result = await this.employeeStatisticsService.getStatisticsByEmployeeId(id, findInput);
        console.log('======================================================')
        console.log(result)
        return this.employeeStatisticsService.getStatisticsByEmployeeId(id, findInput);
    }
}
