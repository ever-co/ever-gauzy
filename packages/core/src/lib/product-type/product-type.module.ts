import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ProductType } from './product-type.entity';
import { ProductTypeController } from './product-type.controller';
import { ProductTypeService } from './product-type.service';
import { ProductTypeTranslation } from './product-type-translation.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmProductTypeRepository } from './repository/type-orm-product-type.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([ProductType, ProductTypeTranslation]),
		MikroOrmModule.forFeature([ProductType, ProductTypeTranslation]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [ProductTypeController],
	providers: [ProductTypeService, TypeOrmProductTypeRepository, ...CommandHandlers]
})
export class ProductTypeModule {}
