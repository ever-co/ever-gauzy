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
import {
	BulkExecutor,
	BulkItemResult,
	BulkOperation,
	BulkResult,
	IBulkItemContext
} from './../api';
import { Idempotent } from './../idempotency/idempotent.decorator';
import { CrudController, BaseQueryDTO } from './../core/crud';
import { RequestContext } from './../core/context';
import { ProductService } from './product.service';
import { Product } from './product.entity';
import {
	IBulkProductItem,
	IBulkProductsRequest,
	PRODUCT_BULK_REQUIRED_KEYS,
	productBulkOptions
} from './product.bulk';
import { ProductCreateCommand, ProductUpdateCommand, ProductDeleteCommand } from './commands';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { LanguageDecorator, Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreateProductDTO, UpdateProductDTO } from './dto';

@ApiTags('Product')
@UseGuards(TenantPermissionGuard)
@Controller('/products')
export class ProductController extends CrudController<Product> {
	constructor(
		private readonly productService: ProductService,
		private readonly commandBus: CommandBus,
		private readonly bulkExecutor: BulkExecutor
	) {
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
		@Query() filter: BaseQueryDTO<Product>,
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
	 * GET product by id or slug
	 *
	 * The path carries one value and the resource decides which of the two things it names: an
	 * identifier is read by identifier and anything else is read by slug, in the service, because
	 * which column a value addresses is a fact about the resource and not about the transport that
	 * carried it. The path shape is unchanged, so a client that already sends an identifier sends
	 * exactly what it sent before, and the value that matches no product of the caller's scope is
	 * answered with the platform's own not-found code whichever form it took.
	 *
	 * @param idOrSlug
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Find Product by id or slug ' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record',
		type: Product
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'RESOURCE_NOT_FOUND'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get(':idOrSlug')
	async findById(
		@Param('idOrSlug') idOrSlug: string,
		@Query('data', ParseJsonPipe) data?: any
	): Promise<Product> {
		const { relations = [], findInput = null } = data;
		return this.productService.findOneByIdOrSlug(idOrSlug, {
			relations,
			where: findInput
		});
	}

	/**
	 * POST products in bulk
	 *
	 * One request applies a catalogue batch and answers one outcome per item: what applied, what did
	 * not and the counts derived from both. The batch itself is the platform's — `@BulkOperation`
	 * declares what this route accepts, the executor is configured from that declaration, and it
	 * authorises the whole request once, refuses a batch it cannot read before writing anything, and
	 * rolls an atomic batch back when one of its items fails. A second runner beside that one would be
	 * a second answer to the same question, which is what the platform's bulk contract exists to
	 * prevent.
	 *
	 * The items are applied through the service that owns the product's writes, and the transaction
	 * the atomic case runs in is the service's own, so a batch produces the same rows, the same
	 * refusals and the same authorisation answer as the items would one by one.
	 *
	 * `atomic` is the whole point of the flag: an atomic batch applies every item or none of them, and
	 * a batch that is not atomic applies what it can and reports the rest.
	 *
	 * The route declares no body type: the batch's own checks — the cap, the unreadable item, the
	 * member an item does not carry — belong to the executor, so a validation pipe here could only
	 * refuse a request the contract already refuses, in a second vocabulary.
	 *
	 * @param request
	 * @returns
	 */
	@ApiOperation({ summary: 'Create, update and archive products in bulk' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The batch was applied, with one outcome per item'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'The request or an item could not be read'
	})
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description: 'An atomic batch was refused whole, naming the item that failed'
	})
	@ApiResponse({
		status: HttpStatus.PAYLOAD_TOO_LARGE,
		description: 'BULK_LIMIT_EXCEEDED'
	})
	@ApiResponse({
		status: HttpStatus.UNPROCESSABLE_ENTITY,
		description: 'BULK_ALL_ITEMS_FAILED'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.PRODUCTS_BULK_IMPORT)
	@Idempotent({ scope: 'product.bulk', required: false, resourceType: 'product' })
	@BulkOperation({
		resource: 'product',
		maxItems: 200,
		permission: PermissionsEnum.PRODUCTS_BULK_IMPORT
	})
	@Post('/bulk')
	async bulk(@Body() request: IBulkProductsRequest): Promise<BulkResult<IBulkProductItem>> {
		return await this.bulkExecutor.execute<IBulkProductItem>(
			request,
			(item, context) => this.applyBulkItem(item, context),
			productBulkOptions(ProductController, 'bulk', {
				requiredKeys: PRODUCT_BULK_REQUIRED_KEYS,
				transaction: this.productService.transaction
			})
		);
	}

	/**
	 * Applies one item of a batch through the service that owns the product's writes.
	 *
	 * The route owns no write of its own: the item is handed on with the batch's transactional manager
	 * exactly as the executor resolved it, and the outcome names the row that changed so a client can
	 * match an answer to the row it asked about.
	 *
	 * @param item
	 * @param context
	 * @returns
	 */
	private async applyBulkItem(item: IBulkProductItem, context: IBulkItemContext): Promise<BulkItemResult> {
		const product = await this.productService.applyBulkItem(item, context.manager);

		return { index: context.index, id: product.id };
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
