import { Controller, HttpStatus, Get, Query } from '@nestjs/common';
import { ApiUseTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { UserOrganization as IUserOrganization } from '@gauzy/models';
import { UserOrganizationService } from './user-organization.services';
import { IPagination } from '../core';
import { UserOrganization } from './user-organization.entity';

@ApiUseTags('UserOrganization')
@Controller()
export class UserOrganizationController extends CrudController<
	IUserOrganization
> {
	constructor(
		private readonly userOrganizationService: UserOrganizationService
	) {
		super(userOrganizationService);
	}

	@ApiOperation({ title: 'Find all UserOrganizations.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found UserOrganizations',
		type: UserOrganization
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllEmployees(
		@Query('data') data: string
	): Promise<IPagination<UserOrganization>> {
		const { relations, findInput } = JSON.parse(data);
		return this.userOrganizationService.findAll({
			where: findInput,
			relations
		});
	}

	// This was not being used and it overrides the default unnecessarily, so removed until required.
	// Please do not user Get() for findOne and use something like @Get(/organization/id)
	// @ApiOperation({ title: 'Find one from the search input' })
	// @ApiResponse({ status: HttpStatus.OK, description: 'Found user organization', type: UserOrganization })
	// @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	// @Get()
	// async findOne(@Query('findInputStr') findInputStr: string): Promise<IUserOrganization> {
	//     const findInput = JSON.parse(findInputStr);
	//     return this.userOrganizationService.findOne({ where: findInput });
	// }
}
