import { Body, Controller, Get, HttpStatus, Param, Put, Query, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UpdateResult } from 'typeorm';
import { IEmployee, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { PaginationParams } from '../core/crud';
import { GetEmployeeJobStatisticsCommand, UpdateEmployeeJobSearchStatusCommand } from './commands';
import { EmployeeJobStatisticDTO } from './dto';
import { Employee } from './employee.entity';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
@Controller()
export class EmployeeJobController {
    constructor(
        private readonly _commandBus: CommandBus
    ) { }

    /**
     * GET employee job statistics.
     *
     * This endpoint retrieves statistics related to employee jobs,
     * providing details about job distribution, assignments, or other related data.
     *
     * @param options Pagination parameters for retrieving the data.
     * @returns A paginated list of employee job statistics.
     */
    @ApiOperation({ summary: 'Retrieve employee job statistics' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Employee job statistics found',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid input. The response body may contain clues about what went wrong.',
    })
    @Permissions(PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW)
    @Get('job-statistics')
    @UseValidationPipe({ transform: true })
    async getEmployeeJobsStatistics(
        @Query() options: PaginationParams<Employee>
    ): Promise<IPagination<IEmployee>> {
        return await this._commandBus.execute(
            new GetEmployeeJobStatisticsCommand(options)
        );
    }

    /**
     * UPDATE employee's job search status by their IDs
     *
     * This endpoint allows updating the job search status of an employee, given their ID.
     *
     * @param employeeId The unique identifier of the employee whose job search status is being updated.
     * @param entity The updated job search status information.
     * @returns A promise resolving to the updated employee record or an update result.
     */
    @ApiOperation({ summary: 'Update Job Search Status' })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Job search status has been successfully updated.'
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid input. The response body may contain clues as to what went wrong.',
    })
    @Put(':id/job-search-status')
    @UseValidationPipe({ whitelist: true })
    async updateJobSearchStatus(
        @Param('id', UUIDValidationPipe) employeeId: IEmployee['id'],
        @Body() data: EmployeeJobStatisticDTO
    ): Promise<IEmployee | UpdateResult> {
        return await this._commandBus.execute(
            new UpdateEmployeeJobSearchStatusCommand(employeeId, data)
        );
    }
}
