import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { TenantModule } from '../tenant/tenant.module';
import { AccountingTemplate } from './accounting-template.entity';
import { AccountingTemplateController } from './accounting-template.controller';
import { AccountingTemplateService } from './accounting-template.service';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/accounting-template', module: AccountingTemplateModule }
		]),
		forwardRef(() => TypeOrmModule.forFeature([AccountingTemplate])),
		CqrsModule,
		forwardRef(() => TenantModule),
		TypeOrmModule.forFeature([User])
	],
	controllers: [AccountingTemplateController],
	providers: [AccountingTemplateService, UserService],
	exports: [TypeOrmModule, AccountingTemplateService, UserService]
})
export class AccountingTemplateModule {}
