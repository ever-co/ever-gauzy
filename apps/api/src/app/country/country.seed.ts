import { Connection } from 'typeorm';
import { Country } from './country.entity';

export const createCountries = async (
	connection: Connection
): Promise<Country[]> => {
	for (let index = 0; index < 5; index++) {
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

		countries.forEach(
			async (country) => await insertCountry(connection, country)
		);

		return countries;
	}
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
