import { Controller, Get, HttpStatus, Param, Query, ValidationPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FindConditions } from 'typeorm';
import { IEmployee, IPagination } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { Employee } from './../../core/entities/internal';
import { Public } from './../../shared/decorators';
import { FindOnePublicEmployeeQuery, FindPublicEmployeesByOrganizationQuery } from './queries';

@Public()
@Controller()
export class PublicEmployeeController {

	constructor(
		private readonly queryBus: QueryBus
	) {}

	/**
	 * GET public employees in the specific organization
	 *
	 * @param params
	 * @param options
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find public information for all employees in the organization.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employees in the organization'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Get()
	async findPublicEmployeesByOrganization(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) options: TenantOrganizationBaseDTO
	): Promise<IPagination<IEmployee>> {
		return await this.queryBus.execute(
			new FindPublicEmployeesByOrganizationQuery(options)
		);
	}

	/**
	 * GET public employee by profile link in the specific organization
	 *
	 * @param id
	 * @param profile_link
	 * @returns
	 */
	 @ApiOperation({
		summary: 'Find public information for one employee by profile link in the organization.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee in the organization'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/:profile_link/:id')
	async findPublicEmployeeByProfileLink(
		@Param() params: FindConditions<Employee>
	): Promise<IEmployee> {
		return await this.queryBus.execute(
			new FindOnePublicEmployeeQuery(params)
		);
	}
}