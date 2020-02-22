import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplateService } from './email-template.service';

@Module({
	imports: [TypeOrmModule.forFeature([EmailTemplate])],
	providers: [EmailTemplateService],
	exports: [TypeOrmModule, EmailTemplateService]
})
export class EmailTemplateModule {}
