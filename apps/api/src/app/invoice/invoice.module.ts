import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { Invoice } from './invoice.entity';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { EmailService, EmailModule } from '../email';
import { EstimateEmailService } from '../estimate-email/estimate-email.service';
import { EstimateEmailModule } from '../estimate-email/estimate-email.module';
import { EstimateEmailController } from '../estimate-email/estimate-email.controller';
import { EstimateEmail } from '../estimate-email/estimate-email.entity';
import { TenantModule } from '../tenant/tenant.module';
import { CommandHandlers } from './commands';
import { CqrsModule } from '@nestjs/cqrs';

@Module({
	imports: [
		TypeOrmModule.forFeature([User, Invoice, EstimateEmail]),
		EmailModule,
		EstimateEmailModule,
		TenantModule,
		CqrsModule
	],
	controllers: [InvoiceController, EstimateEmailController],
	providers: [
		InvoiceService,
		UserService,
		EmailService,
		EstimateEmailService,
		...CommandHandlers
	],
	exports: [InvoiceService, UserService, EstimateEmailService]
})
export class InvoiceModule {}
