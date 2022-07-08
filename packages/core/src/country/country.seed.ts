import { DataSource } from 'typeorm';
import { Country } from './country.entity';
import { ICountry } from '@gauzy/contracts';
import { DEFAULT_COUNTRIES } from './default-countries';

export const createCountries = async (
	dataSource: DataSource
): Promise<ICountry[]> => {
	return await new Promise<ICountry[]>(async (resolve, reject) => {
		try {
			const countries: ICountry[] = [];
			const entries = DEFAULT_COUNTRIES;
			for (const key of Object.keys(entries)) {
				if (entries.hasOwnProperty(key)) {
					const country: ICountry = {
						isoCode: key,
						country: entries[key]
					};
					countries.push(country);
				}
			}
			await insertCountry(dataSource, countries);
			resolve(countries);
		} catch (err) {
			console.log('Error parsing country:', err);
			reject(null);
			return;
		}
	});
};

const insertCountry = async (
	dataSource: DataSource,
	countries: ICountry[]
): Promise<void> => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(Country)
		.values(countries)
		.execute();
};
