import { IOrganization, IOrganizationContact, IPagination } from '@gauzy/contracts';
import { Controller, Get, HttpStatus, Param, Query, UseInterceptors, ValidationPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';
import { Public } from '@gauzy/common';
import { OrganizationContact, OrganizationProject } from './../../core/entities/internal';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { PublicTransformInterceptor } from './../public-transform.interceptor';
import { PublicOrganizationQueryDTO } from './dto/public-organization-query.dto';
import { PublicOrganizationService } from './public-organization.service';
import { FindPublicClientsByOrganizationQuery, FindPublicOrganizationQuery } from './queries';

@Public()
@UseInterceptors(PublicTransformInterceptor)
@Controller()
export class PublicOrganizationController {

	constructor(
		private readonly queryBus: QueryBus,
		private readonly publicOrganizationService: PublicOrganizationService
	) {}

	/**
	 * GET public clients in the specific organization
	 *
	 * @param options
	 * @returns
	 */
	 @ApiOperation({
		summary: 'Find public information for all clients in the organization.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found clients in the organization'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Get('client')
	async findPublicClientsByOrganization(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) options: TenantOrganizationBaseDTO
	): Promise<IPagination<IOrganizationContact>> {
		return await this.queryBus.execute(
			new FindPublicClientsByOrganizationQuery(
				options as FindOptionsWhere<OrganizationContact>
			)
		);
	}

	/**
	 * GET public clients counts in the specific organization
	 *
	 * @param options
	 * @returns
	 */
	@Get('client/count')
	async findPublicClientCountsByOrganization(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) options: TenantOrganizationBaseDTO
	): Promise<Number> {
		return await this.publicOrganizationService.findPublicClientCountsByOrganization(
			options as FindOptionsWhere<OrganizationContact>
		)
	}

	/**
	 * GET public clients counts in the specific organization
	 *
	 * @param options
	 * @returns
	 */
	@Get('project/count')
	async findPublicProjectCountsByOrganization(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) options: TenantOrganizationBaseDTO
	): Promise<Number> {
		return await this.publicOrganizationService.findPublicProjectCountsByOrganization(
			options as FindOptionsWhere<OrganizationProject>
		)
	}

	/**
	 * GET organization by profile link
	 *
	 * @param profile_link
	 * @returns
	 */
	@ApiOperation({ summary: 'Find Organization by profile link.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':profile_link')
	async findOneByProfileLink(
		@Param('profile_link') profile_link: string,
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) options: PublicOrganizationQueryDTO
	): Promise<IOrganization> {
		return await this.queryBus.execute(
			new FindPublicOrganizationQuery({ profile_link }, options.relations)
		);
	}
}