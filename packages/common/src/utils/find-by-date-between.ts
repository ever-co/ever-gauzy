import { BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';

type AllowedFields = 'startDate' | 'dueDate' | 'createdAt';

function isValidField(field: string): field is AllowedFields {
	return ['startDate', 'dueDate', 'endDate', 'createdAt'].includes(field);
}

/**
 * Adds a date range condition to a TypeORM query builder
 * @param query - The TypeORM SelectQueryBuilder instance
 * @param field - The date field to filter on
 * @param from - Start date (inclusive, UTC)
 * @param to - End date (inclusive, UTC)
 * @param p - Optional transform function for the query string
 * @returns Modified query builder instance
 * @throws a BadRequestException if from date is after to date
 */
export function addBetween<T>(
	query: SelectQueryBuilder<T>,
	field: string,
	from?: Date,
	to?: Date,
	p?: (queryStr: string) => string
): SelectQueryBuilder<T> {
	if (from && to) {
		if (from > to) {
			throw new BadRequestException('From date must not be after to date');
		}

		// Convert dates to UTC for consistent comparison
		const utcFrom = from.toISOString();
		const utcTo = to.toISOString();

		query.andWhere(p(`"${query.alias}"."${field}" BETWEEN :from AND :to`), { from: utcFrom, to: utcTo });
	}
	return query;
}
