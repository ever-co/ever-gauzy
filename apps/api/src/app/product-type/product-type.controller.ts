import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { CrudController, IPagination } from '../core';
import { ProductType } from './product-type.entity';
import { Controller, HttpStatus, Get, Query, UseGuards } from '@nestjs/common';
import { ProductTypeService } from './product-type.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Product-Types')
@UseGuards(AuthGuard('jwt'))
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
	async findAllProductTypes(
		@Query('data') data: string
	): Promise<IPagination<ProductType>> {
		const { relations, findInput } = JSON.parse(data);
		return this.productTypesService.findAll({
			where: findInput,
			relations
		});
	}
}
