import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Country } from './country.entity';
import { CountryController } from './country.controller';
import { CountryService } from './country.service';
import { TypeOrmCountryRepository } from './repository/type-orm-country.repository';

@Module({
	imports: [TypeOrmModule.forFeature([Country]), MikroOrmModule.forFeature([Country])],
	controllers: [CountryController],
	providers: [CountryService, TypeOrmCountryRepository]
})
export class CountryModule {}
