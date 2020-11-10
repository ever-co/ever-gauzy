import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportCategory } from './report-category.entity';
import { Report } from './report.entity';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
	imports: [TypeOrmModule.forFeature([Report, ReportCategory])],
	controllers: [ReportController],
	providers: [ReportService]
})
export class ReportModule {}
