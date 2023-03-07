import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommandHandlers } from './commands/handlers';
import { EmailReset } from './email-reset.entity';
import { EmailResetService } from './email-reset.service';
import { EmailResetController } from './email-reset.controller';
import { UserModule } from '../user/user.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([
			EmailReset
		]),
		forwardRef(() => TenantModule),
		CqrsModule,
		UserModule
	],
	providers: [
		EmailResetService,
		...CommandHandlers
	],
	exports: [
		TypeOrmModule,
		EmailResetService
	],
	controllers: [EmailResetController]
})
export class EmailResetModule { }
