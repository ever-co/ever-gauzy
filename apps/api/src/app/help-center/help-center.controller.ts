import { IHelpCenter, PermissionsEnum } from '@gauzy/models';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Controller,
	HttpStatus,
	Post,
	Body,
	UseGuards,
	Get,
	Query
} from '@nestjs/common';
import { CrudController, IPagination } from '../core';
import { HelpCenterService } from './help-center.service';
import { HelpCenter } from './help-center.entity';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from '../shared/decorators/permissions';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { ParseJsonPipe } from '../shared';

@ApiTags('knowledge_base')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class HelpCenterController extends CrudController<HelpCenter> {
	constructor(private readonly helpCenterService: HelpCenterService) {
		super(helpCenterService);
	}
	@ApiOperation({
		summary: 'Find all menus.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tree',
		type: HelpCenter
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findMenu(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<HelpCenter>> {
		const { relations = [] } = data;
		return this.helpCenterService.findAll({
			relations
		});
	}

	@ApiOperation({
		summary: 'Create new category'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Success Add category',
		type: HelpCenter
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Post()
	async createNode(@Body() entity: IHelpCenter): Promise<any> {
		return this.helpCenterService.create(entity);
	}
}
