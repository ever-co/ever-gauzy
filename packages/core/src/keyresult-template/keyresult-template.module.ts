import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { KeyresultTemplateController } from './keyresult-template.controller';
import { KeyresultTemplateService } from './keyresult-template.service';
import { KeyResultTemplate } from './keyresult-template.entity';
import { TenantModule } from '../tenant/tenant.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/key-result-templates', module: KeyresultTemplateModule }]),
		TypeOrmModule.forFeature([KeyResultTemplate]),
		MikroOrmModule.forFeature([KeyResultTemplate]),
		TenantModule
	],
	controllers: [KeyresultTemplateController],
	providers: [KeyresultTemplateService],
	exports: [KeyresultTemplateService]
})
export class KeyresultTemplateModule { }
