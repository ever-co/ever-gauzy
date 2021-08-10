import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './../shared/decorators';
import { CrudController } from './../core/crud';
import { Country } from './country.entity';
import { CountryService } from './country.service';

@ApiTags('Country')
@Controller()
@Public()
export class CountryController extends CrudController<Country> {
	constructor(private readonly countryService: CountryService) {
		super(countryService);
	}
}
