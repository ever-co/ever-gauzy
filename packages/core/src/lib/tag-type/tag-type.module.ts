import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TagType } from './tag-type.entity';
import { TagTypeService } from './tag-type.service';
import { TagTypeController } from './tag-type.controller';

@Module({
	imports: [
		RouterModule.register([{ path: '/tag-types', module: TagTypeModule }]),
		TypeOrmModule.forFeature([TagType]),
		MikroOrmModule.forFeature([TagType]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [TagTypeController],
	providers: [TagTypeService],
	exports: [TypeOrmModule, MikroOrmModule, TagTypeService]
})
export class TagTypeModule {}
