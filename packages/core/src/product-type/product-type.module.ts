import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { ProductType } from './product-type.entity';
import { RouterModule } from 'nest-router';
import { ProductTypeController } from './product-type.controller';
import { ProductTypeService } from './product-type.service';
import { ProductTypeTranslation } from './product-type-translation.entity';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { CommandHandlers } from './commands/handlers';

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
		UserModule,
		CqrsModule
	],
	controllers: [ProductTypeController],
	providers: [
		ProductTypeService,
		...CommandHandlers
	],
	exports: [
		TypeOrmModule,
		ProductTypeService
	]
})
export class ProductTypeModule {}
