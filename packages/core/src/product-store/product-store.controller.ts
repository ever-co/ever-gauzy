import { ApiTags } from '@nestjs/swagger';
import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Body,
	HttpCode,
	Post
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CrudController, IPagination, ProductStore } from 'core';
import { ProductStoreService } from './product-store.service';
import { ApiResponse, ApiOperation } from '@nestjs/swagger';
import { ParseJsonPipe } from '../shared/pipes/parse-json.pipe';
import { IProductStore } from '@gauzy/contracts';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';


@ApiTags('ProductStores')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class ProductStoreController extends CrudController<ProductStore> {
	constructor(
		private readonly productStoreService: ProductStoreService
	) {
		super(productStoreService);
		}
		
		@ApiOperation({
			summary: 'Find all product stores.'
		})
		@ApiResponse({
			status: HttpStatus.OK,
			description: 'Found product stores.',
			type: ProductStore
		})
		@ApiResponse({
			status: HttpStatus.NOT_FOUND,
			description: 'Record not found'
		})
		@Get()
		async findAllProductStores(
			@Query('data', ParseJsonPipe) data: any,
			@Query('page') page: any,
			@Query('_limit') limit: any
		): Promise<IPagination<ProductStore>> {
			const {
				relations = [],
				findInput = null} = data;
			return this.productStoreService.findAllProductTypes(
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
			@Body() productStoreInput: IProductStore
		): Promise<ProductStore> {
			return this.productStoreService.createStore(productStoreInput);
		}

	


    
}
