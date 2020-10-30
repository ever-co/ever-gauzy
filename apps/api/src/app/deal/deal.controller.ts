import {
	Controller,
	Get,
	HttpStatus,
	Param,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CrudController, IPagination } from '../core/crud';
import { Deal } from './deal.entity';
import { DealService } from './deal.service';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
import { ParseJsonPipe } from '../shared/pipes/parse-json.pipe';

@ApiTags('Deal')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
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
		@Param() id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<Deal> {
		const { relations = [], findInput: where = null } = data;
		return await this.dealService.findOne(id, {
			relations,
			where
		});
	}
}
