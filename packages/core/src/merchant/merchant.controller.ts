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
import { AuthGuard } from '@nestjs/passport';
import { CrudController, IPagination, Merchant } from 'core';
import { MerchantService } from './merchant.service';
import { ApiResponse, ApiOperation } from '@nestjs/swagger';
import { ParseJsonPipe } from '../shared/pipes/parse-json.pipe';
import { IMerchant } from '@gauzy/contracts';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';


@ApiTags('Merchants')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class MerchantController extends CrudController<Merchant> {
	constructor(
		private readonly merchantService: MerchantService
	) {
		super(merchantService);
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
			@Param('id') id: string,
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
