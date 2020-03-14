import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ExportAllController } from './export-all.controller';
import { ExportAllService } from './export-all.service';
import { CountryService, Country } from '../country';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService, User } from '../user';

@Module({
	imports: [CqrsModule, TypeOrmModule.forFeature([Country, User])],
	controllers: [ExportAllController],
	providers: [ExportAllService, CountryService, UserService],
	exports: [ExportAllService, CountryService, UserService]
})
export class ExportAllModule {}
