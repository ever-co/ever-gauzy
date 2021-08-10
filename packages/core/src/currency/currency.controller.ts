import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { Currency } from './currency.entity';
import { CurrencyService } from './currency.service';

@ApiTags('Currency')
@Controller()
export class CurrencyController extends CrudController<Currency> {
	constructor(private readonly currencyService: CurrencyService) {
		super(currencyService);
	}
}
