import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { Country } from './country.entity';
import { CountryController } from './country.controller';
import { CountryService } from './country.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/country', module: CountryModule }]),
		TypeOrmModule.forFeature([Country]),
		MikroOrmModule.forFeature([Country]),
	],
	controllers: [CountryController],
	providers: [CountryService],
	exports: [CountryService]
})
export class CountryModule { }
