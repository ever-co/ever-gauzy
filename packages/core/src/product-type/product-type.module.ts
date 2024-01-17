import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { ProductType } from './product-type.entity';
import { RouterModule } from '@nestjs/core';
import { ProductTypeController } from './product-type.controller';
import { ProductTypeService } from './product-type.service';
import { ProductTypeTranslation } from './product-type-translation.entity';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { CommandHandlers } from './commands/handlers';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/product-types', module: ProductTypeModule }]),
		TypeOrmModule.forFeature([ProductType, ProductTypeTranslation]),
		MikroOrmModule.forFeature([ProductType, ProductTypeTranslation]),
		TenantModule,
		UserModule,
		CqrsModule
	],
	controllers: [ProductTypeController],
	providers: [ProductTypeService, ...CommandHandlers],
	exports: [TypeOrmModule, ProductTypeService]
})
export class ProductTypeModule { }
