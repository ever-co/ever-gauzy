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
	UsePipes,
	UseInterceptors,
	ExecutionContext
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { FileStorageProviderEnum, IImageAsset, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { FindOptionsWhere } from 'typeorm';
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import { CrudController, PaginationParams } from './../core/crud';
import { FileStorage, UploadedFileStorage } from './../core/file-storage';
import { LazyFileInterceptor } from './../core/interceptors';
import { RequestContext } from './../core/context';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe } from './../shared/pipes';
import { ImageAssetCreateCommand } from './commands';
import { ImageAsset } from './image-asset.entity';
import { ImageAssetService } from './image-asset.service';

@ApiTags('ImageAsset')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.MEDIA_GALLERY_ADD)
@Controller()
export class ImageAssetController extends CrudController<ImageAsset> {
	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _imageAssetService: ImageAssetService
	) {
		super(_imageAssetService);
	}

	/**
	 * Upload image asset on specific tenant file storage
	 *
	 * @param entity
	 * @returns
	 */
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.MEDIA_GALLERY_ADD)
	@Post('upload/:folder')
	@UseInterceptors(
		LazyFileInterceptor('file', {
			storage: (ctx: ExecutionContext) => {
				const request: any = ctx.switchToHttp().getRequest();
				const folder: string = request?.params?.folder || 'image_assets';

				return new FileStorage().storage({
					dest: () => path.join('uploads', folder, RequestContext.currentTenantId() || uuid())
				});
			},
		})
	)
	async upload(
		@UploadedFileStorage() file
	) {
		const provider = new FileStorage().getProvider();

		const entity = new ImageAsset();
		entity.name = file.filename;
		entity.url = file.key;
		entity.size = file.size;
		entity.storageProvider = provider.name.toUpperCase() as FileStorageProviderEnum;

		return await this._commandBus.execute(
			new ImageAssetCreateCommand(entity)
		);
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
		return await this._imageAssetService.countBy(options);
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
		return await this._imageAssetService.paginate(params);
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
		return await this._imageAssetService.findAll(params);
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
		return await this._imageAssetService.findOneByIdString(id);
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
		return await this._imageAssetService.create(entity);
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
		return await this._imageAssetService.deleteAsset(id);
	}
}
