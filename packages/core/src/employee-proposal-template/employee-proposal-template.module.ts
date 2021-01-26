import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeProposalTemplateController } from './employee-proposal-template.controller';
import { EmployeeProposalTemplate } from './employee-proposal-template.entity';
import { EmployeeProposalTemplateService } from './employee-proposal-template.service';

@Module({
	imports: [TypeOrmModule.forFeature([EmployeeProposalTemplate]), CqrsModule],
	controllers: [EmployeeProposalTemplateController],
	providers: [EmployeeProposalTemplateService]
})
export class EmployeeProposalTemplateModule {}
