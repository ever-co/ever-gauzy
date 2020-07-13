import { Controller, Get, HttpStatus, Query, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, IPagination } from '../core';
import { OrganizationSprint } from './organization-sprint.entity';
import { OrganizationSprintService } from './organization-sprint.service';
import { AuthGuard } from '@nestjs/passport';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';

@ApiTags('Organization-Sprint')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class OrganizationSprintController extends CrudController<
	OrganizationSprint
> {
	constructor(
		private readonly organizationSprintService: OrganizationSprintService
	) {
		super(organizationSprintService);
	}

  @ApiOperation({
    summary: 'Find all organization sprint.'
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Found projects',
    type: OrganizationProjects
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Record not found'
  })
  @Get()
  async findAllSprints(
    @Query('data') data: string,
    @Request() req
  ): Promise<IPagination<OrganizationSprint>> {
    const { relations, findInput } = JSON.parse(data);
    return this.organizationSprintService.findAll({
      where: findInput,
      relations
    });

  }

}
