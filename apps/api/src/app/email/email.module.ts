import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplate } from '../email-template';
import { Email } from './email.entity';
import { EmailService } from './email.service';

@Module({
	imports: [TypeOrmModule.forFeature([Email, EmailTemplate])],
	providers: [EmailService],
	exports: [TypeOrmModule]
})
export class EmailModule {}
