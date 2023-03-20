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
import { FindOptionsWhere } from 'typeorm';
import { CrudController, PaginationParams } from './../core/crud';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe } from './../shared/pipes';
import { ImageAsset } from './image-asset.entity';
import { ImageAssetService } from './image-asset.service';

@ApiTags('ImageAsset')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.MEDIA_GALLERY_ADD)
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
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.MEDIA_GALLERY_VIEW)
	@Get('count')
	async getCount(
		@Query() options: FindOptionsWhere<ImageAsset>
	): Promise<number> {
		return await this.imageAssetService.countBy(options);
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
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.MEDIA_GALLERY_VIEW)
	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
	async pagination(
		@Query() params: PaginationParams<ImageAsset>
	): Promise<IPagination<IImageAsset>> {
		return await this.imageAssetService.paginate(params);
	}

	/**
	 * GET image assets
	 *
	 * @param data
	 * @returns
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.MEDIA_GALLERY_VIEW)
	@Get()
	@UsePipes(new ValidationPipe())
	async findAll(
		@Query() params: PaginationParams<ImageAsset>
	): Promise<IPagination<IImageAsset>> {
		return await this.imageAssetService.findAll(params);
	}

	/**
	 * GET image assets by id
	 *
	 * @param id
	 * @returns
	 */
	@HttpCode(HttpStatus.OK)
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.MEDIA_GALLERY_VIEW)
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: IImageAsset['id']
	): Promise<IImageAsset> {
		return await this.imageAssetService.findOneByIdString(id);
	}

	/**
	 * CREATE new image asset
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.MEDIA_GALLERY_ADD)
	@Post()
	async create(
		@Body() entity: ImageAsset
	): Promise<IImageAsset> {
		return await this.imageAssetService.create(entity);
	}

	/**
	 * DELETE image assets
	 *
	 * @param id
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.MEDIA_GALLERY_DELETE)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: IImageAsset['id']
	): Promise<any> {
		return await this.imageAssetService.deleteAsset(id);
	}
}
