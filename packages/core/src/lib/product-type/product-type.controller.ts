import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Body,
	HttpCode,
	Put,
	Param,
	ValidationPipe,
	Post
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { FindOptionsWhere } from 'typeorm';
import { I18nLang } from 'nestjs-i18n';
import { LanguagesEnum, IPagination, PermissionsEnum, ID } from '@gauzy/contracts';
import { ProductTypeService } from './product-type.service';
import { ProductType } from './product-type.entity';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { LanguageDecorator, Permissions } from './../shared/decorators';
import { CrudController, PaginationParams } from './../core/crud';
import { ProductTypeDTO } from './dto';
import { ProductTypeCreateCommand } from './commands';

@ApiTags('ProductTypes')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_EDIT)
@Controller('/product-types')
export class ProductTypeController extends CrudController<ProductType> {
	constructor(private readonly productTypesService: ProductTypeService, private readonly commandBus: CommandBus) {
		super(productTypesService);
	}

	/**
	 * GET inventory product types count
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Find Product Types Count ' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Count Product Types',
		type: ProductType
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_VIEW)
	@Get('count')
	async getCount(@Query() options: FindOptionsWhere<ProductType>): Promise<number> {
		return await this.productTypesService.countBy(options);
	}

	/**
	 * GET inventory product types by pagination
	 *
	 * @param options
	 * @param themeLanguage
	 * @param languageCode
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all product types by pagination' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found product types by pagination',
		type: ProductType
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_VIEW)
	@Get('pagination')
	@UseValidationPipe({ transform: true })
	async pagination(
		@Query() options: PaginationParams<ProductType>,
		@LanguageDecorator() themeLanguage: LanguagesEnum,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<IPagination<ProductType>> {
		return await this.productTypesService.pagination(options, themeLanguage || languageCode);
	}

	/**
	 * GET all product types
	 *
	 * @param options
	 * @param themeLanguage
	 * @returns
	 */
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
	@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_VIEW)
	@Get()
	async findAll(
		@Query(new ValidationPipe()) options: PaginationParams<ProductType>,
		@LanguageDecorator() themeLanguage: LanguagesEnum,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<IPagination<ProductType>> {
		return await this.productTypesService.findProductTypes(options, themeLanguage || languageCode);
	}

	/**
	 * CREATE product type
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
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true })
	async create(
		@Body() entity: ProductTypeDTO,
		@LanguageDecorator() themeLanguage: LanguagesEnum,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<ProductType> {
		return await this.commandBus.execute(new ProductTypeCreateCommand(entity, themeLanguage || languageCode));
	}

	/**
	 * UPDATE product type by id
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
	@UseValidationPipe({ transform: true })
	@Put(':id')
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: ProductTypeDTO): Promise<ProductType> {
		return await this.productTypesService.updateProductType(id, entity);
	}
}
