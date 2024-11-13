import { SelectQueryBuilder } from 'typeorm';

export function addBetween<T>(
	query: SelectQueryBuilder<T>,
	field: string,
	from?: Date,
	to?: Date,
	p?: (queryStr: string) => string
): SelectQueryBuilder<T> {
	if (from && to) {
		query.andWhere(p(`"${query.alias}"."${field}" BETWEEN :from AND :to`), { from, to });
	}
	return query;
}
