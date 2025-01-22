import {
	Controller,
	Get,
	Param,
	Post,
	Body,
	Headers,
	UseGuards,
	Query,
	HttpCode,
	HttpStatus,
	Delete,
	UseInterceptors,
	ExecutionContext
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { FindOptionsWhere } from 'typeorm';
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import * as Jimp from 'jimp';
import { IImageAsset, IPagination, PermissionsEnum, UploadedFile } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { FileStorage, UploadedFileStorage } from './../core/file-storage';
import { LazyFileInterceptor } from './../core/interceptors';
import { RequestContext } from './../core/context';
import { tempFile } from './../core/utils';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { ImageAssetCreateCommand } from './commands';
import { ImageAsset } from './image-asset.entity';
import { ImageAssetService } from './image-asset.service';
import { UploadImageAsset } from './dto';

@ApiTags('ImageAsset')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.MEDIA_GALLERY_ADD)
@Controller('/image-assets')
export class ImageAssetController extends CrudController<ImageAsset> {
	constructor(private readonly _commandBus: CommandBus, private readonly _imageAssetService: ImageAssetService) {
		super(_imageAssetService);
	}

	/**
	 * Upload image asset on specific tenant file storage
	 *
	 * @param entity
	 * @returns
	 */
	@Post('upload/:folder')
	@UseInterceptors(
		LazyFileInterceptor('file', {
			storage: (ctx: ExecutionContext) => {
				const request: any = ctx.switchToHttp().getRequest();
				const folder: string = request?.params?.folder || 'image_assets';

				// Define the base directory for storing media
				const baseDirectory = path.join('uploads', folder);

				// Generate unique sub directories based on the current tenant
				const subDirectory = path.join(RequestContext.currentTenantId() || uuid());

				return new FileStorage().storage({
					dest: () => path.join(baseDirectory, subDirectory)
				});
			}
		})
	)
	@UseValidationPipe({ whitelist: true })
	async upload(
		@UploadedFileStorage() file,
		@Headers() headers: Record<string, string>,
		@Body() entity: UploadImageAsset
	) {
		const provider = new FileStorage().getProvider();
		let thumbnail: UploadedFile;

		try {
			const fileContent = await provider.getFile(file.key);
			const inputFile = await tempFile('media-asset-thumb');
			const outputFile = await tempFile('media-asset-thumb');

			await fs.promises.writeFile(inputFile, fileContent);

			const image = await Jimp.read(inputFile);

			// we are using Jimp.AUTO for height instead of hardcode (e.g. 150px)
			image.resize(250, Jimp.AUTO);

			await image.writeAsync(outputFile);

			const data = await fs.promises.readFile(outputFile);

			try {
				await fs.promises.unlink(inputFile);
				await fs.promises.unlink(outputFile);
			} catch (error) {
				console.error('Error while unlinking temp files:', error);
			}

			const thumbName = `thumb-${file.filename}`;
			const thumbDir = path.dirname(file.key);

			// Replace double backslashes with single forward slashes
			const fullPath = path.join(thumbDir, thumbName).replace(/\\/g, '/');

			thumbnail = await provider.putFile(data, fullPath);
		} catch (error) {
			console.error('Error while uploading media asset into file storage provider:', error);
		}

		// Extract tenant and organization IDs from request headers and body
		const tenantId = headers['tenant-id'] || entity?.tenantId;
		const organizationId = headers['organization-id'] || entity?.organizationId;

		return await this._commandBus.execute(
			new ImageAssetCreateCommand({
				...entity,
				tenantId,
				organizationId,
				name: file.filename,
				url: file.key,
				thumb: thumbnail ? thumbnail.key : null,
				size: file.size,
				storageProvider: provider.name
			})
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
	async getCount(@Query() options: FindOptionsWhere<ImageAsset>): Promise<number> {
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
	@UseValidationPipe({ transform: true })
	async pagination(@Query() params: PaginationParams<ImageAsset>): Promise<IPagination<IImageAsset>> {
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
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<ImageAsset>): Promise<IPagination<IImageAsset>> {
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
	async findById(@Param('id', UUIDValidationPipe) id: IImageAsset['id']): Promise<IImageAsset> {
		return await this._imageAssetService.findOneByIdString(id);
	}

	/**
	 * CREATE new image asset
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@Post()
	async create(@Body() entity: ImageAsset): Promise<IImageAsset> {
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
	async delete(@Param('id', UUIDValidationPipe) id: IImageAsset['id']): Promise<any> {
		return await this._imageAssetService.deleteAsset(id);
	}
}
