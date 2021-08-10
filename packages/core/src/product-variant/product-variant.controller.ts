import {
	Controller,
	HttpStatus,
	Post,
	Body,
	Get,
	HttpCode,
	Put,
	Param,
	UseGuards,
	Delete
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { ProductVariant } from './product-variant.entity';
import { ProductVariantService } from './product-variant.service';
import {
	ProductVariantCreateCommand,
	ProductVariantDeleteCommand
} from './commands';
import { CommandBus } from '@nestjs/cqrs';
import { Product } from '../product/product.entity';
import { DeleteResult } from 'typeorm';
import { IPagination, IVariantCreateInput } from '@gauzy/contracts';
import { TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe } from './../shared/pipes';

@ApiTags('ProductVariant')
@UseGuards(TenantPermissionGuard)
@Controller()
export class ProductVariantController extends CrudController<ProductVariant> {
	constructor(
		private readonly productVariantService: ProductVariantService,
		private readonly commandBus: CommandBus
	) {
		super(productVariantService);
	}

	@ApiOperation({ summary: 'Create product variants' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description:
			'These records have been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	// @UseGuards(PermissionGuard)
	@Post('/create-variants')
	async createProductVariants(
		@Body() entity: IVariantCreateInput,
		...options: any[]
	): Promise<ProductVariant[]> {
		return this.commandBus.execute(new ProductVariantCreateCommand(entity));
	}

	@ApiOperation({
		summary: 'Find all product variants'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found product variants',
		type: Product
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('all')
	async findAllProductVariants(): Promise<IPagination<ProductVariant>> {
		return this.productVariantService.findAllProductVariants();
	}

	@ApiOperation({
		summary: 'Find all variants by product id'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found product variants',
		type: Product
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('all/:productId')
	async findAllVariantsByProduct(@Param('productId', UUIDValidationPipe) productId: string): Promise<IPagination<ProductVariant>> {
		return this.productVariantService.findAllVariantsByProductId(productId);
	}


	@ApiOperation({
		summary: 'Find all product variants'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found product variants',
		type: Product
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: string): Promise<ProductVariant> {
		return this.productVariantService.findOne(id);
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
		@Param('id', UUIDValidationPipe) id: string,
		@Body() productVariant: ProductVariant
	): Promise<ProductVariant> {
		return this.productVariantService.updateVariant(productVariant);
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
		@Param('id', UUIDValidationPipe) id: string,
		...options: any[]
	): Promise<DeleteResult> {
		return this.commandBus.execute(new ProductVariantDeleteCommand(id));
	}

	@ApiOperation({ summary: 'Delete featured image' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete('/delete-featured-image/:variantId')
	async deleteFeaturedImage(
		@Param('variantId', UUIDValidationPipe) variantId: string
	): Promise<ProductVariant> {
		return this.productVariantService.deleteFeaturedImage(variantId);
	}
}
