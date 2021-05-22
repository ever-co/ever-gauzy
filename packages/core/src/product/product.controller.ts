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
	Delete,
	Query
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
import {
	PermissionsEnum,
	IProductCreateInput,
	IProductTranslated,
	IImageAsset
} from '@gauzy/contracts';
import { Permissions } from '../shared/decorators/permissions';
import { ProductDeleteCommand } from './commands';
import { DeleteResult } from 'typeorm';
import { ParseJsonPipe } from '../shared';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';

@ApiTags('Product')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class ProductController extends CrudController<Product> {
	constructor(
		private readonly productService: ProductService,
		private commandBus: CommandBus
	) {
		super(productService);
	}

	@ApiOperation({ summary: 'Find Products Count ' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Count Products',
		type: Product
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('count')
	async count(
		@Query('data', ParseJsonPipe) data?: any
	): Promise<Number> {
		const { findInput = null } = data;

		return this.productService.count(findInput);
	}

	@ApiOperation({ summary: 'Find Product by id ' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record',
		type: Product
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findById(
		@Param('id') id: string,
		@Query('data', ParseJsonPipe) data?: any
	): Promise<Product> {
		const { relations = [], findInput = null } = data;

		return this.productService.findById(id, {
			relations,
			where: findInput
		});
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
	async findAllProducts(): Promise<
		IPagination<Product | IProductTranslated>
	> {
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
		@Param('langCode') langCode: string,
		@Query('data', ParseJsonPipe) data: any,
		@Query('page') page: any,
		@Query('_limit') limit: any
	): Promise<IPagination<Product | IProductTranslated>> {
		const { relations = [], findInput = null } = data;
		return this.productService.findAllProducts(
			langCode,
			relations,
			findInput,
			{ page, limit }
		);
	}

	@ApiOperation({
		summary: 'Find one product translated'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found product',
		type: Product
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('local/:langCode/:id/')
	async findOneProductTranslated(
		@Param('id') id: string,
		@Param('langCode') langCode: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<Product | IProductTranslated> {
		const { relations = [] } = data;
		return this.productService.findByIdTranslated(langCode, id, relations);
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
	async updateProduct(
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

	@ApiOperation({ summary: 'Create gallery image' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The gallery image has been stored.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Post('/add-images/:productId')
	async addGalleryImage(
		@Param('productId') productId: string,
		@Body() images: IImageAsset[]
	) {
		return this.productService.addGalleryImages(productId, images);
	}

	@ApiOperation({ summary: 'Set featured image' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The featured image has been saved.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Post('/set-as-featured/:productId')
	async setAsFeatured(
		@Param('productId') productId: string,
		@Body() image: IImageAsset
	) {
		return this.productService.setAsFeatured(productId, image);
	}

	@ApiOperation({ summary: 'Delete image from gallery' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete('/:productId/delete-gallery-image/:imageId')
	async deleteGaleryImage(
		@Param('productId') productId: string,
		@Param('imageId') imageId: string
	): Promise<Product> {
		return this.productService.deleteGalleryImage(productId, imageId);
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
	@Delete('/delete-featured-image/:productId')
	async deleteFeaturedImage(
		@Param('productId') productId: string
	): Promise<Product> {
		return this.productService.deleteFeaturedImage(productId);
	}
}
