import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Controller,
	Get,
	HttpStatus,
	Query,
	UseGuards,
	HttpCode,
	Put,
	Param,
	Body,
	ValidationPipe,
	Post
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { FindOptionsWhere } from 'typeorm';
import { I18nLang } from 'nestjs-i18n';
import { LanguagesEnum, IPagination, PermissionsEnum, IProductCategoryTranslatable } from '@gauzy/contracts';
import { ProductCategory } from './product-category.entity';
import { ProductCategoryService } from './product-category.service';
import { CrudController, PaginationParams } from './../core/crud';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { LanguageDecorator, Permissions } from './../shared/decorators';
import { ProductCategoryDTO } from './dto';
import { ProductCategoryCreateCommand } from './commands';

@ApiTags('ProductCategories')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT)
@Controller('/product-categories')
export class ProductCategoryController extends CrudController<ProductCategory> {
	constructor(
		private readonly productCategoryService: ProductCategoryService,
		private readonly commandBus: CommandBus
	) {
		super(productCategoryService);
	}

	/**
	 * GET inventory product categories count
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Find product categories Count ' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Count product categories',
		type: ProductCategory
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_PRODUCT_CATEGORIES_VIEW)
	@Get('count')
	async getCount(@Query() options: FindOptionsWhere<ProductCategory>): Promise<number> {
		return await this.productCategoryService.countBy(options);
	}

	/**
	 * GET inventory product categories by pagination
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all product categories by pagination' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found product categories by pagination',
		type: ProductCategory
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_PRODUCT_CATEGORIES_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(
		@Query() options: PaginationParams<ProductCategory>,
		@LanguageDecorator() themeLanguage: LanguagesEnum,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<IPagination<ProductCategory>> {
		return await this.productCategoryService.pagination(options, themeLanguage || languageCode);
	}

	/**
	 * GET all product categories
	 *
	 * @param options
	 * @param themeLanguage
	 * @param languageCode
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all product categories.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found product categories.',
		type: ProductCategory
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_PRODUCT_CATEGORIES_VIEW)
	@Get()
	async findAll(
		@Query(new ValidationPipe()) options: PaginationParams<ProductCategory>,
		@LanguageDecorator() themeLanguage: LanguagesEnum,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<IPagination<ProductCategory>> {
		return await this.productCategoryService.findProductCategories(options, themeLanguage || languageCode);
	}

	/**
	 * CREATE product category
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post()
	@UseValidationPipe({ transform: true })
	async create(
		@Body() entity: ProductCategoryDTO,
		@LanguageDecorator() themeLanguage: LanguagesEnum,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<ProductCategory> {
		return await this.commandBus.execute(new ProductCategoryCreateCommand(entity, themeLanguage || languageCode));
	}

	/**
	 * UPDATE product category by id
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
	@Put(':id')
	@UseValidationPipe({ transform: true })
	async update(
		@Param('id', UUIDValidationPipe) id: IProductCategoryTranslatable['id'],
		@Body() entity: ProductCategoryDTO
	): Promise<ProductCategory> {
		return await this.productCategoryService.updateProductCategory(id, entity);
	}
}
