import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { AccountingTemplate } from './accounting-template.entity';
import { AccountingTemplateController } from './accounting-template.controller';
import { AccountingTemplateService } from './accounting-template.service';
import { QueryHandlers } from './queries/handlers';
import { TypeOrmAccountingTemplateRepository } from './repository/type-orm-accounting-template.repository';

@Module({
	imports: [
		forwardRef(() => TypeOrmModule.forFeature([AccountingTemplate])),
		forwardRef(() => MikroOrmModule.forFeature([AccountingTemplate])),
		forwardRef(() => RolePermissionModule),
		CqrsModule
	],
	controllers: [AccountingTemplateController],
	providers: [AccountingTemplateService, TypeOrmAccountingTemplateRepository, ...QueryHandlers]
})
export class AccountingTemplateModule {}
