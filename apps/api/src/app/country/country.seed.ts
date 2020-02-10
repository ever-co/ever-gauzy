import { Connection } from 'typeorm';
import { Country } from './country.entity';

export const createCountries = async (
	connection: Connection
): Promise<Country[]> => {
	const countries: Country[] = [
		{
			isoCode: 'USA',
			country: 'United States of America'
		},
		{
			isoCode: 'ISR',
			country: 'Israel'
		},
		{
			isoCode: 'BGR',
			country: 'Bulgaria'
		}
	];

	for (let i = 0; i < countries.length; i++) {
		await insertCountry(connection, countries[i]);
	}

	return countries;
};

const insertCountry = async (
	connection: Connection,
	country: Country
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Country)
		.values(country)
		.execute();
};
