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
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { PermissionsEnum, IProductTranslated, IImageAsset, IPagination, LanguagesEnum, ID } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { RequestContext } from './../core/context';
import { ProductService } from './product.service';
import { Product } from './product.entity';
import { ProductCreateCommand, ProductUpdateCommand, ProductDeleteCommand } from './commands';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { LanguageDecorator, Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreateProductDTO, UpdateProductDTO } from './dto';

@ApiTags('Product')
@UseGuards(TenantPermissionGuard)
@Controller('/products')
export class ProductController extends CrudController<Product> {
	constructor(private readonly productService: ProductService, private readonly commandBus: CommandBus) {
		super(productService);
	}

	/**
	 * GET all products translated
	 *
	 * @param langCode
	 * @param data
	 * @param page
	 * @param limit
	 * @returns
	 */
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get('local/:langCode')
	async findAllProductsTranslated(
		@Param('langCode') langCode: LanguagesEnum,
		@Query('data', ParseJsonPipe) data: any,
		@Query('page') page: any,
		@Query('_limit') limit: any
	): Promise<IPagination<Product | IProductTranslated>> {
		const { relations = [], findInput = null } = data;
		return this.productService.findAllProducts(langCode, relations, findInput, { page, limit });
	}

	/**
	 * GET product by language & id
	 *
	 * @param id
	 * @param langCode
	 * @param data
	 * @returns
	 */
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get('local/:langCode/:id')
	async findOneProductTranslated(
		@Param('id', UUIDValidationPipe) id: string,
		@Param('langCode') langCode: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<Product | IProductTranslated> {
		const { relations = [] } = data;
		return this.productService.findByIdTranslated(langCode, id, relations);
	}

	/**
	 * Create product image gallery
	 *
	 * @param productId
	 * @param images
	 * @returns
	 */
	@ApiOperation({ summary: 'Create gallery image' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The gallery image has been stored.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Post('add-images/:productId')
	async addGalleryImage(@Param('productId', UUIDValidationPipe) productId: string, @Body() images: IImageAsset[]) {
		return this.productService.addGalleryImages(productId, images);
	}

	/**
	 * UPDATE product set image as a feature
	 *
	 * @param productId
	 * @param image
	 * @returns
	 */
	@ApiOperation({ summary: 'Set featured image' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The featured image has been saved.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Post('set-as-featured/:productId')
	async setAsFeatured(@Param('productId', UUIDValidationPipe) productId: string, @Body() image: IImageAsset) {
		return this.productService.setAsFeatured(productId, image);
	}

	/**
	 * DELETE product gallery image by id
	 *
	 * @param productId
	 * @param imageId
	 * @returns
	 */
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Delete(':productId/gallery-image/:imageId')
	async deleteGalleryImage(
		@Param('productId', UUIDValidationPipe) productId: ID,
		@Param('imageId', UUIDValidationPipe) imageId: ID
	): Promise<Product> {
		return this.productService.deleteGalleryImage(productId, imageId);
	}

	/**
	 * DELETE product feature image by product id
	 *
	 * @param productId
	 * @returns
	 */
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Delete('featured-image/:productId')
	async deleteFeaturedImage(@Param('productId', UUIDValidationPipe) productId: string): Promise<Product> {
		return this.productService.deleteFeaturedImage(productId);
	}

	/**
	 * GET inventory products count
	 *
	 * @param data
	 * @returns
	 */
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get('count')
	async getCount(@Query('data', ParseJsonPipe) data?: any): Promise<number> {
		const { findInput = null } = data;
		return await this.productService.count({
			where: {
				tenantId: RequestContext.currentTenantId(),
				...findInput
			}
		});
	}

	/**
	 * GET inventory products by pagination
	 *
	 * @param filter
	 * @returns
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(
		@Query() filter: PaginationParams<Product>,
		@LanguageDecorator() themeLanguage: LanguagesEnum
	): Promise<IPagination<Product>> {
		return this.productService.pagination(filter, themeLanguage);
	}

	/**
	 * GET all inventory products in the same tenant
	 *
	 * @param data
	 * @param themeLanguage
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all products' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found products',
		type: Product
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any,
		@LanguageDecorator() themeLanguage: LanguagesEnum
	): Promise<IPagination<any>> {
		return await this.productService.findProducts(data, themeLanguage);
	}

	/**
	 * GET product by id
	 *
	 * @param id
	 * @param data
	 * @returns
	 */
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data?: any
	): Promise<Product> {
		const { relations = [], findInput = null } = data;
		return this.productService.findOneByIdString(id, {
			relations,
			where: findInput
		});
	}

	/**
	 * CREATE new product
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Post()
	@UseValidationPipe({ transform: true })
	async create(@Body() entity: CreateProductDTO): Promise<Product> {
		return await this.commandBus.execute(new ProductCreateCommand(entity));
	}

	/**
	 * UPDATE existing product by id
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Put(':id')
	@UseValidationPipe({ transform: true })
	async update(@Param('id', UUIDValidationPipe) id: string, @Body() entity: UpdateProductDTO): Promise<Product> {
		return await this.commandBus.execute(new ProductUpdateCommand(id, entity));
	}

	/**
	 * DELETE product by id
	 *
	 * @param id
	 * @returns
	 */
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<DeleteResult> {
		return await this.commandBus.execute(new ProductDeleteCommand(id));
	}
}
