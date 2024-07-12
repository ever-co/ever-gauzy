import { Injectable } from '@nestjs/common';
import * as moment from 'moment';
import { Wakatime } from './wakatime.entity';
import { TypeOrmWakatimeRepository } from './repository';

@Injectable()
export class WakatimeService {
	constructor(private readonly typeOrmWakatimeRepository: TypeOrmWakatimeRepository) {}

	/**
	 *
	 * @param params
	 * @returns
	 */
	async getSummaries(params: any): Promise<any> {
		const result = await this.typeOrmWakatimeRepository.query(`
			SELECT SUM(seconds) AS seconds
			FROM (
				SELECT COUNT(*) AS seconds
				FROM heartbeats
				WHERE DATE(time, 'unixepoch') = date('now')
				GROUP BY entities
			) t;
		`);
		return {
			data: [
				{
					categories: [],
					grand_total: {
						digital: `${Math.floor(result[0].seconds / 3600)}:${Math.floor(result[0].seconds / 60)}`,
						hours: Math.floor(result[0].seconds / 3600),
						minute: Math.floor(result[0].seconds / 60),
						total_seconds: result[0].seconds,
						text: `${result[0].seconds} secs`
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
	bulkSave(wakatime: Wakatime[]) {
		return this.typeOrmWakatimeRepository
			.createQueryBuilder()
			.insert()
			.values(wakatime)
			.onConflict(`("time", "entities") do nothing`)
			.execute();
	}

	/**
	 *
	 * @param wakatime
	 * @returns
	 */
	save(wakatime: Wakatime) {
		return this.typeOrmWakatimeRepository
			.createQueryBuilder()
			.insert()
			.values(wakatime)
			.onConflict(`("time", "entities") do nothing`)
			.execute();
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
