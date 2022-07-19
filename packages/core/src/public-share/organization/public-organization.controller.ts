import { IOrganization, IOrganizationContact, IPagination } from '@gauzy/contracts';
import { Controller, Get, HttpStatus, Param, Query, ValidationPipe } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { Public } from './../../shared/decorators';
import { PublicOrganizationService } from './public-organization.service';
import { FindPublicClientsByOrganizationQuery, FindPublicOrganizationQuery } from './queries';

@Public()
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
			new FindPublicClientsByOrganizationQuery(options)
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
		return await this.publicOrganizationService.findPublicClientCountsByOrganization(options)
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
		return await this.publicOrganizationService.findPublicProjectCountsByOrganization(options)
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
		@Param('profile_link') profile_link: string
	): Promise<IOrganization> {
		return await this.queryBus.execute(
			new FindPublicOrganizationQuery({
				profile_link
			})
		);
	}
}