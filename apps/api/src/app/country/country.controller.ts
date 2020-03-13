import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { Country } from './country.entity';
import { CountryService } from './country.service';

@ApiTags('Country')
@Controller()
export class CountryController extends CrudController<Country> {
	constructor(private readonly countryService: CountryService) {
		super(countryService);
	}
	@Get()
	async getALLCountries() {
		return this.countryService.getAsCsv();
	}
}
