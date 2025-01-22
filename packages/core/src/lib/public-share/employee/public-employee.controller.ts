import { Controller, Get, HttpStatus, Param, Query, UseInterceptors } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FindOptionsWhere } from 'typeorm';
import { IEmployee, IPagination } from '@gauzy/contracts';
import { Public } from '@gauzy/common';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { Employee } from './../../core/entities/internal';
import { FindOnePublicEmployeeQuery, FindPublicEmployeesByOrganizationQuery } from './queries';
import { PublicEmployeeQueryDTO } from './dto/public-employee-query.dto';
import { PublicTransformInterceptor } from './../public-transform.interceptor';
import { UseValidationPipe } from '../../shared/pipes';

@Public()
@UseInterceptors(PublicTransformInterceptor)
@Controller('/public/employee')
export class PublicEmployeeController {
	constructor(private readonly queryBus: QueryBus) {}

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
	@UseValidationPipe({ transform: true, whitelist: true })
	async findPublicEmployeesByOrganization(
		@Query() conditions: TenantOrganizationBaseDTO,
		@Query() options: PublicEmployeeQueryDTO
	): Promise<IPagination<IEmployee>> {
		return await this.queryBus.execute(
			new FindPublicEmployeesByOrganizationQuery(conditions as FindOptionsWhere<Employee>, options.relations)
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
	@UseValidationPipe({ transform: true, whitelist: true })
	async findPublicEmployeeByProfileLink(
		@Param() params: FindOptionsWhere<Employee>,
		@Query() options: PublicEmployeeQueryDTO
	): Promise<IEmployee> {
		return await this.queryBus.execute(new FindOnePublicEmployeeQuery(params, options.relations));
	}
}
