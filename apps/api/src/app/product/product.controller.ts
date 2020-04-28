import {
	Controller,
	Get,
	HttpStatus,
	Post,
	Body
	// UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController, IPagination } from '../core';
import { ProductService } from './product.service';
import { Product } from './product.entity';
import { CommandBus } from '@nestjs/cqrs';
import { ProductCreateCommand } from './commands/product.create.command';
// import { PermissionGuard } from '../shared/guards/auth/permission.guard';

@ApiTags('Product')
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
	// @UseGuards(PermissionGuard)
	@Post('/create')
	async createProduct(@Body() entity: Product, ...options: any[]) {
		return this.commandBus.execute(new ProductCreateCommand(entity));
	}
}
