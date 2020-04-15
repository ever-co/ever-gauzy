import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { CrudController, IPagination } from '../core';
import { ProductType } from './product-type.entity';
import { Controller, HttpStatus, Get, Query } from '@nestjs/common';
import { ProductTypeService } from './product-type.service';

@ApiTags('Product-Types')
// @UseGuards(AuthGuard('jwt'))
@Controller()
export class ProductTypeController extends CrudController<ProductType> {
	constructor(private readonly productTypesService: ProductTypeService) {
		super(productTypesService);
	}

	@ApiOperation({
		summary: 'Find all product types.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found product types.',
		type: ProductType
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllEmployees(
		@Query('findInput') findInput: string
	): Promise<IPagination<ProductType>> {
		return this.productTypesService.findAll({
			where: findInput
		});
	}
}
