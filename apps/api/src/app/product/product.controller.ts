import {
	Controller,
	Get,
	HttpStatus,
	Post,
	Body,
	Put,
	Param,
	HttpCode,
	UseGuards,
	Delete
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController, IPagination } from '../core';
import { ProductService } from './product.service';
import { Product } from './product.entity';
import { CommandBus } from '@nestjs/cqrs';
import { ProductCreateCommand } from './commands/product.create.command';
import { ProductUpdateCommand } from './commands/product.update.command';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { PermissionsEnum, IProductCreateInput } from '@gauzy/models';
import { Permissions } from '../shared/decorators/permissions';
import { ProductDeleteCommand } from './commands';
import { DeleteResult } from 'typeorm';

@ApiTags('Product')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ProductController extends CrudController<Product> {
	constructor(
		private readonly productService: ProductService,
		private commandBus: CommandBus
	) {
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

	@ApiOperation({
		summary: 'Find all products translated'
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
	@Get('local/:langCode')
	async findAllProductsTranslated(
		@Param('langCode') langCode: string
	): Promise<IPagination<Product>> {
		return this.productService.findAllProducts(langCode);
	}

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Post('/create')
	async createProduct(
		@Body() entity: IProductCreateInput,
		...options: any[]
	) {
		return this.commandBus.execute(new ProductCreateCommand(entity));
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
		@Body() entity: IProductCreateInput
	): Promise<any> {
		return this.commandBus.execute(new ProductUpdateCommand(id, entity));
	}

	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(
		@Param('id') id: string,
		...options: any[]
	): Promise<DeleteResult> {
		return this.commandBus.execute(new ProductDeleteCommand(id));
	}
}
