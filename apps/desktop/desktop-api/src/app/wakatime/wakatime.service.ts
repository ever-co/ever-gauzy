import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Wakatime } from './wakatime.entity';
import * as moment from 'moment';
@Injectable()
export class WakatimeService {
	constructor(
		@InjectRepository(Wakatime)
		private wakatimeRepository: Repository<Wakatime>
	) {}
	async getSummaries(params): Promise<any> {
		const result = await this.wakatimeRepository
			.query(`SELECT SUM(seconds) as seconds from (
			SELECT COUNT(*) as seconds from heartbeats where DATE(time, 'unixepoch') = date('now') GROUP by entities
		) t;`);
		return {
			data: [
				{
					categories: [],
					grand_total: {
						digital: `${Math.floor(
							result[0].seconds / 3600
						)}:${Math.floor(result[0].seconds / 60)}`,
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

	bulkSave(wakatime: Wakatime[]) {
		return this.wakatimeRepository
			.createQueryBuilder()
			.insert()
			.values(wakatime)
			.onConflict(`("time", "entities") do nothing`)
			.execute();
	}

	parameterSanitize(payload, headers) {
		const params = [];
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
		return this.bulkSave(params);
	}

	_extractAgent(userAgent, field) {
		const agents = userAgent.split(' ');
		let value = null;
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

		return value;
	}
}
