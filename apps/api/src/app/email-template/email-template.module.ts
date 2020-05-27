import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateController } from './email-template.controller';

@Module({
	imports: [TypeOrmModule.forFeature([EmailTemplate])],
	controllers: [EmailTemplateController],
	providers: [EmailTemplateService],
	exports: [TypeOrmModule, EmailTemplateService]
})
export class EmailTemplateModule {}
