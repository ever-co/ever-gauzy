import { ApiTags } from '@nestjs/swagger';
import {
	Controller,
	UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
import { CrudController, ProductStore } from 'core';
import { ProductStoreService } from './product-store.service';

@ApiTags('ProductStores')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class ProductCategoryController extends CrudController<ProductStore> {
	constructor(
		private readonly productStoreService: ProductStoreService
	) {
		super(productStoreService);
    }
    
}
