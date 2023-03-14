import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { IOrganizationTeamJoinRequest, IPagination, LanguagesEnum } from '@gauzy/contracts';
import { Public } from '@gauzy/common';
import { PaginationParams } from './../core/crud';
import { LanguageDecorator } from './../shared/decorators';
import { OrganizationTeamJoinRequestCreateCommand } from './commands';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';
import { OrganizationTeamJoinRequestService } from './organization-team-join-request.service';
import { ValidateJoinRequestDTO } from './dto';

@ApiTags('OrganizationTeamJoinRequest')
@Controller()
export class OrganizationTeamJoinRequestController {

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _organizationTeamJoinRequestService: OrganizationTeamJoinRequestService,
	) { }

	/**
	 * Validate organization team join request
	 *
	 * @param params
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Post('validate')
	@UsePipes(new ValidationPipe({ whitelist: true }))
	@Public()
	async validateJoinRequest(
		@Body() entity: ValidateJoinRequestDTO
	): Promise<IOrganizationTeamJoinRequest> {
		return await this._organizationTeamJoinRequestService.validateJoinRequest(entity);
	}

	/**
	 * Get organization team join requests
	 *
	 * @param params
	 * @returns
	 */
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
	@UsePipes(new ValidationPipe())
	@Public()
	async create(
		@Body() entity: OrganizationTeamJoinRequest,
		@LanguageDecorator() languageCode: LanguagesEnum
	): Promise<IOrganizationTeamJoinRequest> {
		return await this._commandBus.execute(
			new OrganizationTeamJoinRequestCreateCommand(
				entity,
				languageCode
			)
		);
	}
}
