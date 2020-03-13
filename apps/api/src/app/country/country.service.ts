import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { Country } from './country.entity';
import * as fs from 'fs';
import * as csv from 'csv-writer';

@Injectable()
export class CountryService extends CrudService<Country> {
	constructor(
		@InjectRepository(Country)
		private readonly countryRepository: Repository<Country>
	) {
		super(countryRepository);
	}
	async convertToCsv() {
		await fs.access('./export/csv', (error) => {
			if (!error) {
				return null;
			} else {
				fs.mkdir('./export/csv', { recursive: true }, (err) => {
					if (err) throw err;
				});
			}
		});
		const createCsvWriter = csv.createObjectCsvWriter;
		const dataIn = [];
		const incommingData = (await this.findAll()).items;
		const dataKeys = Object.keys(incommingData[0]);
		for (const count of dataKeys) {
			dataIn.push({ id: count, title: count });
		}
		const csvWriter = createCsvWriter({
			path: './export/csv/country.csv',
			header: dataIn
		});
		const data = incommingData;
		csvWriter
			.writeRecords(data)
			.then(() => console.log('The CSV file was written successfully'));
	}
}
