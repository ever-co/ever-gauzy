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
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import {
	LanguagesEnum,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import { ProductTypeService } from './product-type.service';
import { ProductType } from './product-type.entity';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { LanguageDecorator, Permissions } from './../shared/decorators';
import { CrudController, PaginationParams } from './../core/crud';
import { RequestContext } from './../core/context';

@ApiTags('ProductTypes')
@UseGuards(TenantPermissionGuard)
@Controller()
export class ProductTypeController extends CrudController<ProductType> {
	constructor(private readonly productTypesService: ProductTypeService) {
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_VIEW)
	@Get('count')
	async getCount(
		@Query('data', ParseJsonPipe) data?: any
	): Promise<number> {
		const { findInput = null } = data;
		return await this.productTypesService.count({
			where: {
				tenantId: RequestContext.currentTenantId(),
				...findInput
			}
		});
	}

	/**
	 * GET inventory product types by pagination
	 * 
	 * @param filter 
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_VIEW)
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<ProductType>,
		@LanguageDecorator() themeLanguage: LanguagesEnum
	): Promise<IPagination<ProductType>> {
		return await this.productTypesService.pagination(
			filter,
			themeLanguage
		);
	}

	/**
	 * GET all product types
	 * 
	 * @param data 
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_VIEW)
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any,
		@LanguageDecorator() themeLanguage: LanguagesEnum
	): Promise<IPagination<any>> {
		return await this.productTypesService.findProductTypes(
			data,
			themeLanguage
		);
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_PRODUCT_TYPES_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: ProductType
	): Promise<any> {
		return this.productTypesService.updateProductType(id, entity);
	}
}
