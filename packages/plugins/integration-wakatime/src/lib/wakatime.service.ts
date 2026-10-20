import { Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { MultiORM, MultiORMEnum, getORMType } from '@gauzy/core';
import { Wakatime } from './wakatime.entity';
import { TypeOrmWakatimeRepository } from './repository/type-orm-wakatime.repository';
import { MikroOrmWakatimeRepository } from './repository/mikro-orm-wakatime.repository';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

/**
 * Splits a number of seconds into whole hours and the minutes left over.
 *
 * The summary used `seconds / 60` for the minutes, i.e. the TOTAL minutes, so 3,700 s read "1:61"
 * instead of "1:01". A day without heartbeats sums to `null`; it, and any non-numeric or negative value,
 * counts as 0.
 */
export function splitDuration(seconds: number | string | null | undefined): {
	totalSeconds: number;
	hours: number;
	minutes: number;
} {
	const value = Number(seconds);
	const totalSeconds = Number.isFinite(value) && value > 0 ? value : 0;
	return {
		totalSeconds,
		hours: Math.floor(totalSeconds / 3600),
		minutes: Math.floor((totalSeconds % 3600) / 60)
	};
}

/**
 * Shapes the outcome of a MikroORM (knex) insert like TypeORM's `InsertResult`.
 *
 * The MikroORM branches ran the insert and returned `undefined`, so `POST /heartbeats.bulk` read
 * `result.identifiers.length` off nothing and answered 400 although the rows were stored. One identifier
 * is reported per submitted value, as TypeORM does for `orIgnore()` inserts.
 */
export function toInsertResult(
	count: number,
	raw: any
): { identifiers: Record<string, any>[]; generatedMaps: Record<string, any>[]; raw: any } {
	return {
		identifiers: Array.from({ length: count }, () => ({})),
		generatedMaps: [],
		raw
	};
}

@Injectable()
export class WakatimeService {
	constructor(
		private readonly typeOrmWakatimeRepository: TypeOrmWakatimeRepository,
		private readonly mikroOrmWakatimeRepository: MikroOrmWakatimeRepository
	) {}

	/**
	 *
	 * @param params
	 * @returns
	 */
	async getSummaries(params: any): Promise<any> {
		let result: any[];

		switch (ormType) {
			case MultiORMEnum.MikroORM: {
				const knex = (this.mikroOrmWakatimeRepository as any).getKnex();
				result = await knex
					.raw(
						`
					SELECT SUM(seconds) AS seconds
					FROM (
						SELECT COUNT(*) AS seconds
						FROM heartbeats
						WHERE DATE(time, 'unixepoch') = date('now')
						GROUP BY entities
					) t;
				`
					)
					.then((res: any) => (Array.isArray(res) ? res : res.rows || [res]));
				break;
			}
			case MultiORMEnum.TypeORM:
			default:
				result = await this.typeOrmWakatimeRepository.query(`
					SELECT SUM(seconds) AS seconds
					FROM (
						SELECT COUNT(*) AS seconds
						FROM heartbeats
						WHERE DATE(time, 'unixepoch') = date('now')
						GROUP BY entities
					) t;
				`);
				break;
		}

		const { totalSeconds, hours, minutes } = splitDuration(result[0]?.seconds);

		return {
			data: [
				{
					categories: [],
					grand_total: {
						digital: `${hours}:${String(minutes).padStart(2, '0')}`,
						hours,
						minute: minutes,
						total_seconds: totalSeconds,
						text: `${totalSeconds} secs`
					},
					range: {
						date: moment().format('YYYY-MM-DD'),
						end: moment().endOf('day').utc(),
						start: moment().startOf('day').utc(),
						text: 'Today'
					}
				}
			],
			end: moment().endOf('day').utc(),
			start: moment().startOf('day').utc()
		};
	}

	/**
	 *
	 * @param wakatime
	 * @returns
	 */
	async bulkSave(wakatime: Wakatime[]) {
		switch (ormType) {
			case MultiORMEnum.MikroORM: {
				const knex = (this.mikroOrmWakatimeRepository as any).getKnex();
				const raw = await knex('heartbeats')
					.insert(wakatime.map((w) => ({ ...w })))
					.onConflict(['time', 'entities'])
					.ignore();
				return toInsertResult(wakatime.length, raw);
			}
			case MultiORMEnum.TypeORM:
			default:
				return this.typeOrmWakatimeRepository
					.createQueryBuilder()
					.insert()
					.values(wakatime)
					.orIgnore()
					.execute();
		}
	}

	/**
	 *
	 * @param wakatime
	 * @returns
	 */
	async save(wakatime: Wakatime) {
		switch (ormType) {
			case MultiORMEnum.MikroORM: {
				const knex = (this.mikroOrmWakatimeRepository as any).getKnex();
				const raw = await knex('heartbeats')
					.insert({ ...wakatime })
					.onConflict(['time', 'entities'])
					.ignore();
				return toInsertResult(1, raw);
			}
			case MultiORMEnum.TypeORM:
			default:
				return this.typeOrmWakatimeRepository
					.createQueryBuilder()
					.insert()
					.values(wakatime)
					.orIgnore()
					.execute();
		}
	}

	/**
	 *
	 * @param payload
	 * @param headers
	 * @returns
	 */
	parameterSanitize(payload, headers) {
		const params = [];
		if (!Array.isArray(payload)) {
			payload = [payload];
		}
		payload.forEach((element) => {
			params.push({
				type: element.type,
				employeeId: null,
				time: element.time,
				categories: element.category,
				dependencies: element.dependencies,
				languages: element.language,
				machine: headers['x-machine-name'],
				projects: element.project,
				branches: element.branch,
				operating_systems: this._extractAgent(element.user_agent, 'os'),
				entities: element.entity,
				editors: this._extractAgent(element.user_agent, 'editors'),
				lines: element.lines,
				is_write: element.is_write,
				user_agent: this._extractAgent(element.user_agent, 'agents')
			});
		});

		if (params.length > 1) {
			return this.bulkSave(params);
		} else {
			return this.save(params[0]);
		}
	}

	/**
	 *
	 * @param userAgent
	 * @param field
	 * @returns
	 */
	_extractAgent(userAgent, field) {
		let value = null;
		try {
			const agents = userAgent.split(' ');
			switch (field) {
				case 'os':
					value = agents[1].split('(')[1].split('-')[0];
					break;
				case 'editors':
					value = agents[3].split('/')[0];
					break;
				case 'agents':
					value = agents[4].split('/')[0];
					break;
				default:
					break;
			}
		} catch (error) {}

		return value;
	}
}
