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
	UsePipes
} from '@nestjs/common';
import {
	LanguagesEnum,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import { ProductCategory } from './product-category.entity';
import { ProductCategoryService } from './product-category.service';
import { CrudController, PaginationParams } from './../core/crud';
import { RequestContext } from './../core/context';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { LanguageDecorator, Permissions } from './../shared/decorators';

@ApiTags('ProductCategories')
@UseGuards(TenantPermissionGuard)
@Controller()
export class ProductCategoryController extends CrudController<ProductCategory> {
	constructor(
		private readonly productCategoriesService: ProductCategoryService
	) {
		super(productCategoriesService);
	}

	/**
	 * GET inventory product categories count
	 * 
	 * @param data 
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_PRODUCT_CATEGORIES_VIEW)
	@Get('count')
	async getCount(
		@Query('data', ParseJsonPipe) data?: any
	): Promise<number> {
		const { findInput = null } = data;
		return await this.productCategoriesService.count({
			where: {
				tenantId: RequestContext.currentTenantId(),
				...findInput
			}
		});
	}
 
	 /**
	  * GET inventory product categories by pagination
	  * 
	  * @param filter 
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_PRODUCT_CATEGORIES_VIEW)
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<ProductCategory>,
		@LanguageDecorator() themeLanguage: LanguagesEnum
	): Promise<IPagination<ProductCategory>> {
		return await this.productCategoriesService.pagination(
			filter,
			themeLanguage
		);
	}

	/**
	 * GET all product categories
	 * 
	 * @param data 
	 * @param themeLanguage 
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
		@Query('data', ParseJsonPipe) data: any,
		@LanguageDecorator() themeLanguage: LanguagesEnum
	): Promise<IPagination<any>> {
		return await this.productCategoriesService.findProductCategories(
			data,
			themeLanguage
		);
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_PRODUCT_CATEGORIES_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: ProductCategory
	): Promise<any> {
		return this.productCategoriesService.updateProductCategory(id, entity);
	}
}
