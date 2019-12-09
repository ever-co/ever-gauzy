import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { Country } from './country.entity';
import { CountryService } from './country.service';

@ApiUseTags('Country')
@Controller()
export class CountryController extends CrudController<Country> {
	constructor(private readonly countryService: CountryService) {
		super(countryService);
	}
}
