import { Repository } from 'typeorm';
import * as _ from 'underscore';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DBHelper<T> {
	findBy: string;
	constructor(private repository: Repository<T>) {}

	find(find: string) {
		this.findBy = find;
		return this;
	}

	async sync(relation: string, new_values: any[]) {
		const row: T = await this.repository.findOne(this.findBy, {
			relations: [relation]
		});
		const values: any[] = row[relation];

		const toRemove = _.difference(values, new_values);
		const toAdd = _.difference(new_values, values);

		row[relation] = values
			.concat(toAdd)
			.filter((value) => toRemove.indexOf(value) === -1);
		const resp = await this.repository.save(row);
		return resp;
	}
}
