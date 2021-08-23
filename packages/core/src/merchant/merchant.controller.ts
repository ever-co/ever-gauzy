import { ApiTags } from '@nestjs/swagger';
import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Body,
	HttpCode,
	Post,
	Put,
	Param
} from '@nestjs/common';
import { ApiResponse, ApiOperation } from '@nestjs/swagger';
import { IMerchant, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { Merchant } from './merchant.entity';
import { MerchantService } from './merchant.service';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';


@ApiTags('Merchants')
@UseGuards(TenantPermissionGuard)
@Controller()
export class MerchantController extends CrudController<Merchant> {
	constructor(
		private readonly merchantService: MerchantService
	) {
		super(merchantService);
	}

	@ApiOperation({ summary: 'Find Merchants Count ' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Count Products',
		type: Number
	})
	@Get('count')
	async count(
		@Query('data', ParseJsonPipe) data?: any
	): Promise<Number> {
		const { findInput = null } = data;

		return this.merchantService.count(findInput);
	}

	@ApiOperation({
		summary: 'Get merchant by id.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found merchant.',
		type: Merchant
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findMerchantById(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<Merchant> {
		const {relations = []} = data;
		return this.merchantService.findMerchantById(
			id,
			relations
		);
	}
	
	@ApiOperation({
		summary: 'Find all product stores.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found product stores.',
		type: Merchant
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllMerchants(
		@Query('data', ParseJsonPipe) data: any,
		@Query('page') page: any,
		@Query('_limit') limit: any
	): Promise<IPagination<Merchant>> {
		const {
			relations = [],
			findInput = null} = data;
		return this.merchantService.findAllMechants(
			relations,
			findInput,
			{page, limit}
		);
	}


	@ApiOperation({ summary: 'Create record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
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
	@Post()
	async create(
		@Body() merchantInput: IMerchant
	): Promise<Merchant> {
		return this.merchantService.createMerchant(merchantInput);
	}


	@ApiOperation({ summary: 'Update record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully updated.'
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
	async updateMerchant(
		@Body() productStoreInput: IMerchant
	): Promise<Merchant> {
		return this.merchantService.updateMerchant(productStoreInput);
	}    
}
