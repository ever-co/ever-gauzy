import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, Get, HttpStatus, Param, Query, UseInterceptors } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { FindOptionsWhere } from 'typeorm';
import { Public } from '@gauzy/common';
import { IOrganizationTeam } from '@gauzy/contracts';
import { OrganizationTeam } from './../../core/entities/internal';
import { FindPublicTeamQuery } from './queries';
import { PublicTransformInterceptor } from './../public-transform.interceptor';
import { PublicTeamQueryDTO } from './dto';
import { UseValidationPipe } from '../../shared/pipes';

@Public()
@UseInterceptors(PublicTransformInterceptor)
@Controller('/public/team')
export class PublicTeamController {
	constructor(private readonly _queryBus: QueryBus) {}

	/**
	 * GET team by profile link
	 *
	 * @param params
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Find Team by profile link.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':profile_link/:id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findOneByProfileLink(
		@Param() params: FindOptionsWhere<OrganizationTeam>,
		@Query() options: PublicTeamQueryDTO
	): Promise<IOrganizationTeam> {
		return await this._queryBus.execute(new FindPublicTeamQuery(params, options));
	}
}
