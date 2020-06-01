import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailTemplate } from './email-template.entity';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplateController } from './email-template.controller';
import { QueryHandlers } from './queries/handlers';
import { CqrsModule } from '@nestjs/cqrs';

@Module({
	imports: [TypeOrmModule.forFeature([EmailTemplate]), CqrsModule],
	controllers: [EmailTemplateController],
	providers: [EmailTemplateService, ...QueryHandlers],
	exports: [TypeOrmModule, EmailTemplateService]
})
export class EmailTemplateModule {}
