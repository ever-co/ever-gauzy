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
	Delete
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IImageAsset, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
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

	@Get('/:id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<IImageAsset> {
		return this.imageAssetService.findOne(id);
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.INVENTORY_GALLERY_EDIT)
	@Post()
	async create(
		@Body() entity: ImageAsset
	): Promise<IImageAsset> {
		return this.imageAssetService.create(entity);
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<any> {
		return this.imageAssetService.deleteAsset(id);
	}
}
