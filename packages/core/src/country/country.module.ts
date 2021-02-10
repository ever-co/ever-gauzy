import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { Country } from './country.entity';
import { CountryController } from './country.controller';
import { CountryService } from './country.service';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/country', module: CountryModule }]),
		TypeOrmModule.forFeature([Country])
	],
	controllers: [CountryController],
	providers: [CountryService],
	exports: [CountryService]
})
export class CountryModule {}
