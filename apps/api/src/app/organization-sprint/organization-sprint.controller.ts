import { Body, Controller, Get, HttpCode, HttpStatus, Param, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CrudController, IPagination } from '../core';
import { OrganizationSprint } from './organization-sprint.entity';
import { OrganizationSprintService } from './organization-sprint.service';
import { AuthGuard } from '@nestjs/passport';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { OrganizationSprintUpdateInput } from '@gauzy/models';
import { OrganizationSprintUpdateCommand } from './commands/organization-sprint.update.command';
import { CommandBus } from '@nestjs/cqrs';

@ApiTags('Organization-Sprint')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class OrganizationSprintController extends CrudController<
	OrganizationSprint
> {
	constructor(
		private readonly organizationSprintService: OrganizationSprintService,
    private readonly commandBus: CommandBus
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

  @ApiOperation({ summary: 'Update an existing record' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The record has been successfully edited.'
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Record not found'
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description:
      'Invalid input, The response body may contain clues as to what went wrong'
  })
  @HttpCode(HttpStatus.ACCEPTED)
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() entity: OrganizationSprintUpdateInput
  ): Promise<any> {
    return this.commandBus.execute(
      new OrganizationSprintUpdateCommand(id, entity)
    );
  }


}
