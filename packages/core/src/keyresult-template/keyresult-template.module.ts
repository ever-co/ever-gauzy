import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { KeyresultTemplateController } from './keyresult-template.controller';
import { KeyresultTemplateService } from './keyresult-template.service';
import { KeyResultTemplate } from './keyresult-template.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/key-result-templates', module: KeyresultTemplateModule }
		]),
		TypeOrmModule.forFeature([KeyResultTemplate]),
		TenantModule
	],
	controllers: [KeyresultTemplateController],
	providers: [KeyresultTemplateService],
	exports: [KeyresultTemplateService]
})
export class KeyresultTemplateModule {}
