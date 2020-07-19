import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplate } from '../email-template';
import { Email } from './email.entity';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';
import { Organization } from '../organization/organization.entity';

@Module({
	imports: [TypeOrmModule.forFeature([Email, EmailTemplate, Organization])],
	controllers: [EmailController],
	providers: [EmailService],
	exports: [TypeOrmModule]
})
export class EmailModule {}
