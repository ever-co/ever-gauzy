import { SelectQueryBuilder } from 'typeorm';
import { prepareSQLQuery as p } from './../../../core/';

export function addBetween<T>(
	query: SelectQueryBuilder<T>,
	field: string,
	from?: Date,
	to?: Date
): SelectQueryBuilder<T> {
	if (from && to) {
		query.andWhere(p(`"${query.alias}"."${field}" BETWEEN :from AND :to`), { from, to });
	}
	return query;
}
