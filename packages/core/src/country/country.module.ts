import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Country } from './country.entity';
import { CountryController } from './country.controller';
import { CountryService } from './country.service';

@Module({
	imports: [TypeOrmModule.forFeature([Country])],
	controllers: [CountryController],
	providers: [CountryService],
	exports: [CountryService]
})
export class CountryModule {}
