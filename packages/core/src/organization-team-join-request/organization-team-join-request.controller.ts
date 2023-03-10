import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IOrganizationTeamJoinRequest, IPagination } from '@gauzy/contracts';
import { Public } from '@gauzy/common';
import { PaginationParams } from './../core/crud';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';
import { OrganizationTeamJoinRequestService } from './organization-team-join-request.service';

@ApiTags('OrganizationTeamJoinRequest')
@Controller()
export class OrganizationTeamJoinRequestController {
	constructor(private readonly _organizationTeamJoinRequestService: OrganizationTeamJoinRequestService) {}

	@HttpCode(HttpStatus.OK)
	@Get()
	@UsePipes(new ValidationPipe())
	async findAll(
		@Query() params: PaginationParams<OrganizationTeamJoinRequest>
	): Promise<IPagination<IOrganizationTeamJoinRequest>> {
		return await this._organizationTeamJoinRequestService.findAll(params);
	}

	/**
	 * Create organization team join request.
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	@Public()
	async create(@Body() entity: OrganizationTeamJoinRequest): Promise<IOrganizationTeamJoinRequest> {
		return await this._organizationTeamJoinRequestService.create(entity);
	}
}
