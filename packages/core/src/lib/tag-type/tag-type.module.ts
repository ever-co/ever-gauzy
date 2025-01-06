import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TagType } from './tag-type.entity';
import { TagTypeService } from './tag-type.service';
import { TagTypeController } from './tag-type.controller';
import { TypeOrmTagTypeRepository } from './repository/type-orm-tag-type.repository';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([TagType]),
		MikroOrmModule.forFeature([TagType]),
		RolePermissionModule
	],
	controllers: [TagTypeController],
	providers: [TagTypeService, TypeOrmTagTypeRepository],
	exports: [TagTypeService]
})
export class TagTypeModule {}
