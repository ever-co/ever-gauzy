import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { CrudController, IPagination } from '../core';
import { ProductCategory } from './product-category.entity';
import { ProductCategoryService } from './product-category.service';
import { AuthGuard } from '@nestjs/passport';

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
		@Query('data') data: string
	): Promise<IPagination<ProductCategory>> {
		const { relations, findInput } = JSON.parse(data);
		return this.productCategoriesService.findAll({
			where: findInput,
			relations
		});
	}
}
