import { ID, IHelpCenter, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards,
	UsePipes
} from '@nestjs/common';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AuthGuard } from '@nestjs/passport';
import { CommandBus } from '@nestjs/cqrs';
import {
	AbstractValidationPipe,
	CrudController,
	ParseJsonPipe,
	PermissionGuard,
	Permissions,
	TenantOrganizationBaseDTO,
	TenantPermissionGuard,
	UUIDValidationPipe
} from '@gauzy/core';
import { HelpCenterService } from './help-center.service';
import { HelpCenter } from './help-center.entity';
import { HelpCenterUpdateCommand, KnowledgeBaseBulkDeleteCommand } from './commands';

@ApiTags('KnowledgeBase')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller('/help-center')
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
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IHelpCenter>> {
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Post('updateBulk')
	async updateBulk(@Body() input: any): Promise<IHelpCenter[]> {
		const { oldChildren = [], newChildren = [] } = input;
		return await this.commandBus.execute(new HelpCenterUpdateCommand(oldChildren, newChildren));
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
	async findByBaseId(@Param('baseId', UUIDValidationPipe) baseId: string): Promise<IHelpCenter[]> {
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Delete('base/:baseId')
	async deleteBulkByBaseId(@Param('baseId', UUIDValidationPipe) baseId: string): Promise<any> {
		return await this.commandBus.execute(new KnowledgeBaseBulkDeleteCommand(baseId));
	}

	/**
	 * UPDATE a knowledge base / category by id
	 *
	 * Overrides the inherited `CrudController.update()` route only to attach the permission gate:
	 * `PermissionGuard` authorizes any route that carries no `@Permissions` metadata, so an
	 * inherited handler is reachable by every member of the tenant until it is gated here.
	 */
	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The record has been successfully edited.' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: QueryDeepPartialEntity<HelpCenter>
	): Promise<any> {
		return super.update(id, entity);
	}

	/**
	 * DELETE a knowledge base / category by id
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach the permission gate.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'The record has been successfully deleted' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<any> {
		return super.delete(id);
	}

	/**
	 * SOFT DELETE a knowledge base / category by id
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach the permission gate.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<HelpCenter> {
		return super.softRemove(id, ...options);
	}

	/**
	 * RESTORE a soft-deleted knowledge base / category by id
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach the permission gate.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_HELP_CENTER_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<HelpCenter> {
		return super.softRecover(id, ...options);
	}
}
