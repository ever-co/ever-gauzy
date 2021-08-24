import {
	Controller,
	Get,
	Param,
	Post,
	Body,
	UseGuards,
	Query,
	HttpCode,
	HttpStatus,
	Delete,
	ValidationPipe,
	UsePipes
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IImageAsset, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { ImageAsset } from './image-asset.entity';
import { ImageAssetService } from './image-asset.service';

@ApiTags('ImageAsset')
@UseGuards(TenantPermissionGuard)
@Controller()
export class ImageAssetController extends CrudController<ImageAsset> {
	constructor(
		private readonly imageAssetService: ImageAssetService
	) {
		super(imageAssetService);
	}

	/**
	 * GET image assets counts
	 * 
	 * @param filter
	 * @returns 
	 */
	@ApiOperation({ summary: 'Find all image assets counts in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found image assets count'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVENTORY_GALLERY_VIEW)
	@Get('count')
	async getCount(
		@Query() filter: PaginationParams<IImageAsset>
	): Promise<number> {
		return await this.imageAssetService.count(filter);
	}

	/**
	 * GET image assets by pagination  
	 * 
	 * @param filter 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Find all image assets in the same tenant using pagination.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found image assets in the tenant',
		type: ImageAsset
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVENTORY_GALLERY_VIEW)
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() filter: PaginationParams<IImageAsset>
	): Promise<IPagination<IImageAsset>> {
		return this.imageAssetService.paginate(filter);
	}

	/**
	 * GET image assets
	 * 
	 * @param data 
	 * @returns 
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVENTORY_GALLERY_VIEW)
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IImageAsset>> {
		const { relations, findInput } = data;
		return this.imageAssetService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * GET image assets by id
	 * 
	 * @param id 
	 * @returns 
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVENTORY_GALLERY_VIEW)
	@Get('/:id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<IImageAsset> {
		return this.imageAssetService.findOne(id);
	}

	/**
	 * CREATE new image asset
	 * 
	 * @param entity 
	 * @returns 
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVENTORY_GALLERY_EDIT)
	@Post()
	async create(
		@Body() entity: ImageAsset
	): Promise<IImageAsset> {
		return this.imageAssetService.create(entity);
	}

	/**
	 * DELETE image assets
	 * 
	 * @param id 
	 * @returns 
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVENTORY_GALLERY_EDIT)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<any> {
		return this.imageAssetService.deleteAsset(id);
	}
}
