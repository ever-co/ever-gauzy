import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	Get
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from '../core';
import { KeyResultTemplate } from './keyresult-template.entity';
import { KeyresultTemplateService } from './keyresult-template.service';
import { AuthGuard } from '@nestjs/passport';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';

@ApiTags('keyResultTemplate')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class KeyresultTemplateController extends CrudController<
	KeyResultTemplate
> {
	constructor(
		private readonly keyResultTemplateService: KeyresultTemplateService
	) {
		super(keyResultTemplateService);
	}

	@ApiOperation({ summary: 'Create KeyResult Template' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'KeyResult Template Created successfully',
		type: KeyResultTemplate
	})
	@Post('/create')
	async createGoal(@Body() entity: KeyResultTemplate): Promise<any> {
		return this.keyResultTemplateService.create(entity);
	}

	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('all')
	async getAll() {
		return this.keyResultTemplateService.findAll();
	}
}
