import { IHelpCenter, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Controller,
	HttpStatus,
	Post,
	Body,
	UseGuards,
	Get,
	Query,
	Delete,
	Param
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CommandBus } from '@nestjs/cqrs';
import {
	CrudController,
	ParseJsonPipe,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	UUIDValidationPipe
} from '@gauzy/core';
import { HelpCenterService } from './help-center.service';
import { HelpCenter } from './help-center.entity';
import {
	HelpCenterUpdateCommand,
	KnowledgeBaseBulkDeleteCommand
} from './commands';

@ApiTags('KnowledgeBase')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class HelpCenterController extends CrudController<HelpCenter> {
	constructor(
		private readonly helpCenterService: HelpCenterService,
		private readonly commandBus: CommandBus
	) {
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
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IHelpCenter>> {
		const { relations = [], findInput = null } = data;
		return this.helpCenterService.findAll({
			relations,
			where: findInput
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
	async create(@Body() entity: IHelpCenter): Promise<IHelpCenter> {
		return this.helpCenterService.create(entity);
	}

	@ApiOperation({ summary: 'Update indexes in Bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Indexes have been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Post('updateBulk')
	async updateBulk(@Body() input: any): Promise<IHelpCenter[]> {
		const { oldChildren = [], newChildren = [] } = input;
		return await this.commandBus.execute(
			new HelpCenterUpdateCommand(oldChildren, newChildren)
		);
	}

	@ApiOperation({
		summary: 'Find Categories By Base Id.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found base categories',
		type: HelpCenter
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('base/:baseId')
	async findByBaseId(
		@Param('baseId', UUIDValidationPipe) baseId: string
	): Promise<IHelpCenter[]> {
		return this.helpCenterService.getCategoriesByBaseId(baseId);
	}

	@ApiOperation({
		summary: 'Delete Categories By Base Id.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found base categories',
		type: HelpCenter
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Delete('base/:baseId')
	async deleteBulkByBaseId(
		@Param('baseId', UUIDValidationPipe) baseId: string
	): Promise<any> {
		return await this.commandBus.execute(
			new KnowledgeBaseBulkDeleteCommand(baseId)
		);
	}
}
