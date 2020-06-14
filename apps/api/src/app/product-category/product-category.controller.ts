import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Controller,
	Get,
	HttpStatus,
	Query,
	UseGuards,
	HttpCode,
	Put,
	Param,
	Body
} from '@nestjs/common';
import { CrudController, IPagination } from '../core';
import { ProductCategory } from './product-category.entity';
import { ProductCategoryService } from './product-category.service';
import { AuthGuard } from '@nestjs/passport';
import { ParseJsonPipe } from '../shared';
import { LanguagesEnum, ProductCategoryTranslated } from '@gauzy/models';

@ApiTags('Product-Categories')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ProductCategoryController extends CrudController<ProductCategory> {
	constructor(
		private readonly productCategoriesService: ProductCategoryService
	) {
		super(productCategoriesService);
	}

	@ApiOperation({
		summary: 'Find all product categories.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found product categories.',
		type: ProductCategory
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllProductCategories(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ProductCategory | ProductCategoryTranslated>> {
		const {
			relations = [],
			findInput = null,
			langCode = LanguagesEnum.ENGLISH
		} = data;
		return this.productCategoriesService.findAllProductCategories(
			relations,
			findInput,
			langCode
		);
	}

	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
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
	async update(
		@Param('id') id: string,
		@Body() entity: ProductCategory
	): Promise<any> {
		return this.productCategoriesService.updateProductCategory(id, entity);
	}
}
