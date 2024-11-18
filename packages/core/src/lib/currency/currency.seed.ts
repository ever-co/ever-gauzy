import { DataSource } from 'typeorm';
import { ICurrency, DEFAULT_CURRENCIES } from '@gauzy/contracts';
import { Currency } from './currency.entity';

export const createCurrencies = async (
	dataSource: DataSource
): Promise<ICurrency[]> => {
	return await new Promise<ICurrency[]>(async (resolve, reject) => {
		try {
			const currencies: ICurrency[] = [];
			const entries = DEFAULT_CURRENCIES;
			for (const key of Object.keys(entries)) {
				if (entries.hasOwnProperty(key)) {
					const currency: ICurrency = {
						isoCode: key,
						currency: entries[key]
					};
					currencies.push(currency);
				}
			}
			await insertCurrency(dataSource, currencies);
			resolve(currencies);
		} catch (err) {
			console.log('Error parsing currency:', err);
			reject(null);
			return;
		}
	});
};

const insertCurrency = async (
	dataSource: DataSource,
	currencies: ICurrency[]
): Promise<void> => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(Currency)
		.values(currencies)
		.execute();
};
