import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { KeyresultTemplateController } from './keyresult-template.controller';
import { KeyresultTemplateService } from './keyresult-template.service';
import { KeyResultTemplate } from './keyresult-template.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/key-result-templates', module: KeyresultTemplateModule }]),
		TypeOrmModule.forFeature([KeyResultTemplate]),
		MikroOrmModule.forFeature([KeyResultTemplate]),
		RolePermissionModule
	],
	controllers: [KeyresultTemplateController],
	providers: [KeyresultTemplateService],
	exports: [KeyresultTemplateService]
})
export class KeyresultTemplateModule { }
