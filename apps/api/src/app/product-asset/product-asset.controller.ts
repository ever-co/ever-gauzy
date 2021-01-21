import {
	Controller,
	Get,
	Param,
	Post,
	Body,
	UseGuards,
	Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CrudController, IPagination } from '../core';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { PermissionsEnum } from '@gauzy/models';
import { Permissions } from '../shared/decorators/permissions';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
import { ParseJsonPipe } from '../shared/pipes/parse-json.pipe';
import { ProductAsset } from './product-asset.entity';
import { ProductAssetService } from './product-asset.service';

@ApiTags('ProductAsset')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class ProductAssetController extends CrudController<ProductAsset> {
	constructor(private readonly productAssetService: ProductAssetService) {
		super(productAssetService);
	}

	@Get('/:id')
	async findById(@Param('id') id: string): Promise<ProductAsset> {
		return this.productAssetService.findOne(id);
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_TAGS_EDIT)
	@Post()
	async createRecord(@Body() entity: ProductAsset): Promise<ProductAsset> {
		return this.productAssetService.create(entity);
	}

	@Get()
	async getAllAssets(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ProductAsset>> {
		const { relations, findInput } = data;
		return this.productAssetService.findAll({
			where: findInput,
			relations
		});
	}
}
