import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductType } from './product-type.entity';
import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { ProductTypeController } from './product-type.controller';
import { ProductTypeService } from './product-type.service';
import { ProductTypeTranslation } from './product-type-translation.entity';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/product-types', module: ProductTypeModule }
		]),
		TypeOrmModule.forFeature([
			ProductType,
			ProductTypeTranslation
		]),
		TenantModule,
		UserModule
	],
	controllers: [ProductTypeController],
	providers: [ProductTypeService],
	exports: [
		TypeOrmModule,
		ProductTypeService
	]
})
export class ProductTypeModule {}
