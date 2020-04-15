import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController, IPagination } from '../core';
import { ProductService } from './product.service';
import { Product } from './product.entity';

@ApiTags('Product')
@Controller()
export class ProductController extends CrudController<Product> {
	constructor(private readonly productService: ProductService) {
		super(productService);
	}

	@ApiOperation({
		summary: 'Find all products'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found products',
		type: Product
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllProducts(): Promise<IPagination<Product>> {
		return this.productService.findAllProducts();
	}
}
