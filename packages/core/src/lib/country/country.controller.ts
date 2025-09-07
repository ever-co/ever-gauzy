import { Controller, Get, HttpStatus, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IPagination } from '@gauzy/contracts';
import { Public } from '@gauzy/common';
import { Country } from './country.entity';
import { CountryService } from './country.service';

@ApiTags('Country')
@Controller('/country')
@Public()
export class CountryController {
	constructor(private readonly countryService: CountryService) {}

	@ApiOperation({ summary: 'Find all countries.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found countries',
		type: Country
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(): Promise<IPagination<Country>> {
		return this.countryService.findAll();
	}

	@ApiOperation({ summary: 'Find a country by ISO code.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found country',
		type: Country
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Country not found'
	})
	@Get('/:isoCode')
	async findByIsoCode(@Param('isoCode') isoCode: string): Promise<Country> {
		const country = await this.countryService.findByIsoCode(isoCode);
		if (!country) {
			throw new NotFoundException(`Country with ISO code "${isoCode}" not found`);
		}
		return country;
	}
}
