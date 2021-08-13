import {
	Controller,
	UseGuards,
	HttpStatus,
	Post,
	Body,
	Get,
	Query
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IKeyResultTemplate, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { KeyResultTemplate } from './keyresult-template.entity';
import { KeyresultTemplateService } from './keyresult-template.service';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe } from './../shared/pipes';

@ApiTags('keyResultTemplate')
@UseGuards(TenantPermissionGuard)
@Controller()
export class KeyresultTemplateController extends CrudController<KeyResultTemplate> {
	constructor(
		private readonly keyResultTemplateService: KeyresultTemplateService
	) {
		super(keyResultTemplateService);
	}

	@ApiOperation({ summary: 'Find key result templates.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found key result templates',
		type: KeyResultTemplate
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IKeyResultTemplate>> {
		const { relations, findInput } = data;
		return this.keyResultTemplateService.findAll({
			where: findInput,
			relations
		});
	}

	@ApiOperation({ summary: 'Create KeyResult Template' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'KeyResult Template Created successfully',
		type: KeyResultTemplate
	})
	@Post()
	async create(
		@Body() entity: KeyResultTemplate
	): Promise<IKeyResultTemplate> {
		return this.keyResultTemplateService.create(entity);
	}
}
