import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ExportAllController } from './export-all.controller';
import { ExportAllService } from './export-all.service';
import { CountryService, Country } from '../country';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
	imports: [CqrsModule, TypeOrmModule.forFeature([Country])],
	controllers: [ExportAllController],
	providers: [ExportAllService, CountryService],
	exports: [ExportAllService, CountryService]
})
export class ExportAllModule {}
