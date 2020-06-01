import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { CrudController, IPagination } from '../core';
import { ProductType } from './product-type.entity';
import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Body,
	HttpCode,
	Put,
	Param
} from '@nestjs/common';
import { ProductTypeService } from './product-type.service';
import { AuthGuard } from '@nestjs/passport';
import { ParseJsonPipe } from '../shared/pipes/parse-json.pipe';
import { LanguagesEnum, ProductTypeTranslatable } from '@gauzy/models';

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
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ProductType | ProductTypeTranslatable>> {
		const {
			relations = [],
			findInput = null,
			langCode = LanguagesEnum.ENGLISH
		} = data;
		return this.productTypesService.findAllProductTypes(
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
		@Body() entity: ProductType
	): Promise<any> {
		return this.productTypesService.updateProductType(id, entity);
	}
}
