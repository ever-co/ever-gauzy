import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { AccountingTemplate } from './accounting-template.entity';
import { AccountingTemplateController } from './accounting-template.controller';
import { AccountingTemplateService } from './accounting-template.service';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/accounting-template', module: AccountingTemplateModule }
		]),
		forwardRef(() => TypeOrmModule.forFeature([AccountingTemplate])),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		CqrsModule,
	],
	controllers: [AccountingTemplateController],
	providers: [
		AccountingTemplateService,
		...QueryHandlers
	],
	exports: [AccountingTemplateService]
})
export class AccountingTemplateModule {}
