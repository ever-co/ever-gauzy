import { IEmployee, IPagination } from '@gauzy/contracts';
import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FindConditions } from 'typeorm';
import { Employee, Organization } from './../../core/entities/internal';
import { Public } from './../../shared/decorators';
import { GetPublicEmployeesByOrganizationQuery } from './queries';

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
		description: 'Record not found'
	})
	@Get(':profile_link')
	async getAllEmployeesByProfileLink(
		@Param() params: FindConditions<Organization>,
		@Query() options: FindConditions<Employee>
	): Promise<IPagination<IEmployee>> {
		return await this.queryBus.execute(
			new GetPublicEmployeesByOrganizationQuery(params, options)
		);
	}
}