import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { KeyresultTemplateController } from './keyresult-template.controller';
import { KeyresultTemplateService } from './keyresult-template.service';
import { KeyResultTemplate } from './keyresult-template.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmKeyResultTemplateRepository } from './repository/type-orm-keyresult-template.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([KeyResultTemplate]),
		MikroOrmModule.forFeature([KeyResultTemplate]),
		RolePermissionModule
	],
	controllers: [KeyresultTemplateController],
	providers: [KeyresultTemplateService, TypeOrmKeyResultTemplateRepository]
})
export class KeyresultTemplateModule {}
