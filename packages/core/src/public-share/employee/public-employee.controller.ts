import { IEmployee, IPagination } from '@gauzy/contracts';
import { Controller, Get, HttpStatus, Param, Query, ValidationPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FindConditions } from 'typeorm';
import { Organization } from './../../core/entities/internal';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { UUIDValidationPipe } from './../../shared/pipes';
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
		description: 'Record not found'
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

	@Get('/:profile_link/:id')
	async findPublicEmployeeByProfileLink(
		@Param('profile_link') profile_link: string,
		@Param('id', UUIDValidationPipe) id: string,
	) {}
}