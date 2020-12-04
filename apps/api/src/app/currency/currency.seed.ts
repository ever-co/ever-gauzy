import { Connection } from 'typeorm';
// import * as fs from 'fs';
// import * as path from 'path';
import { ICurrency } from '@gauzy/models';
import { Currency } from './currency.entity';
// import { environment as env } from '@env-api/environment';
import { DEFAULT_CURRENCY_ENTITY } from './currency';

/* export const createCurrencies = async (
	connection: Connection
): Promise<ICurrency[]> => {
	return await new Promise<ICurrency[]>((resolve, reject) => {
		const baseDir = env.isElectron
			? path.resolve(env.gauzyUserPath, ...['src', 'app', 'currency'])
			: path.resolve('.', ...['apps', 'api', 'src', 'app', 'currency']);

		fs.readFile(
			path.join(baseDir, 'currency.json'),
			'utf8',
			async (err, json) => {
				if (err) {
					console.log(
						'Error reading currency json file from disk:',
						err
					);
					reject(null);
					return;
				}
				try {
					const currencies: ICurrency[] = [];
					const entries = JSON.parse(json);
					for (const key of Object.keys(entries)) {
						if (entries.hasOwnProperty(key)) {
							const currency: ICurrency = {
								isoCode: key,
								currency: entries[key]
							};
							currencies.push(currency);
						}
					}
					await insertCurrency(connection, currencies);
					resolve(currencies);
				} catch (err) {
					console.log('Error parsing currency JSON string:', err);
					reject(null);
					return;
				}
			}
		);
	});
}; */

export const createCurrencies = async (
	connection: Connection
): Promise<ICurrency[]> => {
	return await new Promise<ICurrency[]>(async (resolve, reject) => {
		try {
			const currencies: ICurrency[] = [];
			const entries = DEFAULT_CURRENCY_ENTITY;
			for (const key of Object.keys(entries)) {
				if (entries.hasOwnProperty(key)) {
					const currency: ICurrency = {
						isoCode: key,
						currency: entries[key]
					};
					currencies.push(currency);
				}
			}
			await insertCurrency(connection, currencies);
			resolve(currencies);
		} catch (err) {
			console.log('Error parsing currency:', err);
			reject(null);
			return;
		}
	});
};

const insertCurrency = async (
	connection: Connection,
	currencies: ICurrency[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Currency)
		.values(currencies)
		.execute();
};
