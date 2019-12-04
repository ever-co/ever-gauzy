import { Connection } from 'typeorm';
import { Countries } from './countries.entity';

export const createCountries = async (
	connection: Connection
): Promise<Countries[]> => {
	for (let index = 0; index < 5; index++) {
		const countries: Countries[] = [
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
	country: Countries
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Countries)
		.values(country)
		.execute();
};
