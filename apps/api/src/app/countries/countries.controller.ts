import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { Countries } from './countries.entity';
import { CountriesService } from './countries.service';

@ApiUseTags('Countries')
@Controller()
export class CountriesController extends CrudController<Countries> {
	constructor(private readonly countriesService: CountriesService) {
		super(countriesService);
	}
}
