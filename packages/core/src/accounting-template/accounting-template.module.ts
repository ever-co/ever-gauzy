import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';
import { AccountingTemplate } from './accounting-template.entity';
import { AccountingTemplateController } from './accounting-template.controller';
import { AccountingTemplateService } from './accounting-template.service';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		RouterModule.register([{ path: '/accounting-template', module: AccountingTemplateModule }]),
		forwardRef(() => TypeOrmModule.forFeature([AccountingTemplate])),
		forwardRef(() => MikroOrmModule.forFeature([AccountingTemplate])),
		forwardRef(() => TenantModule),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => UserModule),
		CqrsModule
	],
	controllers: [AccountingTemplateController],
	providers: [AccountingTemplateService, ...QueryHandlers],
	exports: [AccountingTemplateService]
})
export class AccountingTemplateModule { }
