import { Body, Controller, HttpCode, HttpStatus, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
	IPaginationParam,
	IOrganizationTeamJoinRequest,
	IOrganizationTeamJoinRequestFindInput,
	IOrganizationTeamJoinRequestUpdateInput,
	IOrganizationTeamJoinRequestCreateInput
} from '@gauzy/contracts';
import { Public } from '@gauzy/common';
import { CrudFactory, PaginationParams } from './../core/crud';
import { CountQueryDTO } from './../shared/dto';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';
import { OrganizationTeamJoinRequestService } from './organization-team-join-request.service';

@ApiTags('OrganizationTeamJoinRequest')
@Controller()
export class OrganizationTeamJoinRequestController extends CrudFactory<
	OrganizationTeamJoinRequest,
	IPaginationParam,
	IOrganizationTeamJoinRequestCreateInput,
	IOrganizationTeamJoinRequestUpdateInput,
	IOrganizationTeamJoinRequestFindInput
>(PaginationParams, OrganizationTeamJoinRequest, OrganizationTeamJoinRequest, CountQueryDTO) {

	constructor(
		private readonly _organizationTeamJoinRequestService: OrganizationTeamJoinRequestService
	) {
		super(_organizationTeamJoinRequestService);
	}

	/**
	 * Create organization team join request.
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@Public()
	@Post()
	@UsePipes(new ValidationPipe({ whitelist: true }))
	async create(
		@Body() entity: OrganizationTeamJoinRequest
	): Promise<IOrganizationTeamJoinRequest> {
		return await this._organizationTeamJoinRequestService.create(entity);
	}
}
