import {
	Controller,
	Get,
	HttpStatus,
	Param,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { Deal } from './deal.entity';
import { DealService } from './deal.service';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('Deal')
@UseGuards(TenantPermissionGuard)
@Controller()
export class DealController extends CrudController<Deal> {
	public constructor(private readonly dealService: DealService) {
		super(dealService);
	}

	@ApiOperation({ summary: 'Find all deals' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records'
	})
	@Get()
	public async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<Deal>> {
		const { relations = [], findInput: where = null } = data;
		return this.dealService.findAll({
			relations,
			where
		});
	}

	@ApiOperation({ summary: 'Find one deal' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found record'
	})
	@Get(':id')
	public async getOne(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<Deal> {
		const { relations = [], findInput: where = null } = data;
		return await this.dealService.findOneByIdString(id, {
			relations,
			where
		});
	}
}
