import { Connection } from 'typeorm';
import { Country } from './country.entity';
import * as fs from 'fs';
import * as path from 'path';
import { ICountry } from '@gauzy/models';

export const createCountries = async (
	connection: Connection
): Promise<ICountry[]> => {
	// const countries: ICountry[] = [
	// 	{
	// 		isoCode: 'USA',
	// 		country: 'United States of America'
	// 	},
	// 	{
	// 		isoCode: 'ISR',
	// 		country: 'Israel'
	// 	},
	// 	{
	// 		isoCode: 'BGR',
	// 		country: 'Bulgaria'
	// 	}
	// ];
	return await new Promise<ICountry[]>((resolve, reject) => {
		const baseDir = path.join(
			process.cwd(),
			'apps',
			'api',
			'src',
			'app',
			'country'
		);
		fs.readFile(
			path.join(baseDir, 'country.json'),
			'utf8',
			async (err, json) => {
				if (err) {
					console.log(
						'Error reading country json file from disk:',
						err
					);
					reject(null);
					return;
				}
				try {
					const countries: ICountry[] = [];
					const entries = JSON.parse(json);
					for (const key of Object.keys(entries)) {
						if (entries.hasOwnProperty(key)) {
							const country: ICountry = {
								isoCode: key,
								country: entries[key]
							};
							countries.push(country);
							await insertCountry(connection, country);
						}
					}
					resolve(countries);
				} catch (err) {
					console.log('Error parsing country JSON string:', err);
					reject(null);
					return;
				}
			}
		);
	});
};

const insertCountry = async (
	connection: Connection,
	country: ICountry
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Country)
		.values(country)
		.execute();
};
