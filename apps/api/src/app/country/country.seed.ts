import { Connection } from 'typeorm';
import { Country } from './country.entity';
// import * as fs from 'fs';
// import * as path from 'path';
import { ICountry } from '@gauzy/models';
import { DEFAULT_COUNTRY_ENTITY } from './country';
// import { environment as env } from '@env-api/environment';

/* export const createCountries = async (
	connection: Connection
): Promise<ICountry[]> => {
	return await new Promise<ICountry[]>((resolve, reject) => {
		const baseDir = env.isElectron
			? path.resolve(env.gauzyUserPath, ...['src', 'app', 'country'])
			: path.resolve('.', ...['apps', 'api', 'src', 'app', 'country']);

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
						}
					}
					await insertCountry(connection, countries);
					resolve(countries);
				} catch (err) {
					console.log('Error parsing country JSON string:', err);
					reject(null);
					return;
				}
			}
		);
	});
}; */

export const createCountries = async (
	connection: Connection
): Promise<ICountry[]> => {
	return await new Promise<ICountry[]>(async (resolve, reject) => {
		try {
			const countries: ICountry[] = [];
			const entries = DEFAULT_COUNTRY_ENTITY;
			for (const key of Object.keys(entries)) {
				if (entries.hasOwnProperty(key)) {
					const country: ICountry = {
						isoCode: key,
						country: entries[key]
					};
					countries.push(country);
				}
			}
			await insertCountry(connection, countries);
			resolve(countries);
		} catch (err) {
			console.log('Error parsing country:', err);
			reject(null);
			return;
		}
	});
};

const insertCountry = async (
	connection: Connection,
	countries: ICountry[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Country)
		.values(countries)
		.execute();
};
