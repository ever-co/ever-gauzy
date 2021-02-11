import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { EmailTemplate } from '../email-template';
import { Email } from './email.entity';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { Organization } from '../organization/organization.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/email', module: EmailModule }]),
		forwardRef(() =>
			TypeOrmModule.forFeature([Email, EmailTemplate, Organization])
		),
		forwardRef(() => TenantModule)
	],
	controllers: [EmailController],
	providers: [EmailService],
	exports: [TypeOrmModule]
})
export class EmailModule {}
