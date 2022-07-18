import { Controller, Get, HttpStatus, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from './../../shared/decorators';
import { FindPublicOrganizationQuery } from './queries';

@Public()
@Controller()
export class PublicOrganizationController {

	constructor(
		private readonly queryBus: QueryBus
	) {}

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
	) {
		return await this.queryBus.execute(
			new FindPublicOrganizationQuery({
				profile_link
			})
		);
	}
}