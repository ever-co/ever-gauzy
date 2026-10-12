import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsArray, IsDate, IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ID, IGetTimeLogConflictInput } from '@gauzy/contracts';
import { moment } from './../../../../core/moment-extend';
import { parseRelationsString } from './../../../../shared/dto';

/**
 * Relations the conflict endpoint is allowed to join and select.
 *
 * `GetConflictTimeLogHandler` turns every name in `relations` into a `leftJoinAndSelect` with no
 * further checking, so the list has to be an allow-list rather than whatever a caller invents.
 *
 * `timeSlots` is deliberately absent: the handler already inner-joins it under that exact alias, and
 * asking for it again makes TypeORM throw on the duplicate alias.
 */
export enum TimeLogConflictRelationEnum {
	employee = 'employee',
	timesheet = 'timesheet',
	project = 'project',
	task = 'task',
	organizationContact = 'organizationContact',
	organizationTeam = 'organizationTeam'
}

/**
 * Parses a query value into a UTC `Date`, or `undefined` when it is not a date at all.
 *
 * The handler interpolates these values into the overlap predicate, so an unparseable one must be
 * rejected by validation rather than reaching the query as the string `null`.
 */
export function toUtcDate({ value }: TransformFnParams): Date | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	const parsed = moment.utc(value instanceof Date ? value : String(value));
	return parsed.isValid() ? parsed.toDate() : undefined;
}

/**
 * Normalises `ignoreId` into an array; the UI sends it as `ignoreId[0]=<uuid>`, other callers as a
 * bare value.
 *
 * An EMPTY result is reported as `undefined`, never as `[]`. `GetConflictTimeLogHandler` guards the
 * exclusion with a plain `if (input.ignoreId)`, and an empty array is truthy: it would reach
 * `NOT IN (:...id)`, which the drivers expand by joining the values — an empty list leaves
 * `NOT IN ()` and the database rejects the statement. `?ignoreId=` used to be a falsy `''` that the
 * handler simply skipped, so anything but `undefined` here would turn a harmless query into a 500.
 */
export function toIdArray({ value }: TransformFnParams): ID[] | undefined {
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	const ids = (Array.isArray(value) ? value : [value]).filter(
		(it) => it !== undefined && it !== null && it !== ''
	);
	return ids.length > 0 ? ids : undefined;
}

/**
 * Parses `relations` exactly like the shared transform, then drops repeated names.
 *
 * `GetConflictTimeLogHandler` emits one `leftJoinAndSelect(..., relation)` per entry using the
 * relation name as the join alias, so `relations=project,project` would register the alias twice and
 * TypeORM would throw — a 500 on input that passes the allow-list. Order is preserved.
 */
export function toUniqueRelations(params: TransformFnParams): string[] {
	return [...new Set(parseRelationsString(params))];
}

/**
 * Get conflicting time logs request DTO validation.
 *
 * The route used to bind the raw `IGetTimeLogConflictInput` interface with no pipe at all, which
 * meant an arbitrary `employeeId`, `organizationId` and relation list flowed straight into the
 * query. Shape validation here is only half of the fix — `TimeLogService.getConflictTimeLogs`
 * decides whether the caller may read that employee's logs.
 */
export class GetTimeLogConflictQueryDTO implements IGetTimeLogConflictInput {
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly employeeId: ID;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	readonly organizationId: ID;

	@ApiProperty({ type: () => Date })
	@IsNotEmpty()
	@Transform(toUtcDate)
	@IsDate()
	readonly startDate: Date;

	@ApiProperty({ type: () => Date })
	@IsNotEmpty()
	@Transform(toUtcDate)
	@IsDate()
	readonly endDate: Date;

	@ApiPropertyOptional({ type: () => [String], isArray: true })
	@IsOptional()
	@Transform(toIdArray)
	@IsArray()
	@IsUUID('all', { each: true })
	readonly ignoreId?: ID[];

	@ApiPropertyOptional({ type: () => String, enum: TimeLogConflictRelationEnum, isArray: true })
	@IsOptional()
	@Transform(toUniqueRelations)
	@IsEnum(TimeLogConflictRelationEnum, { each: true })
	readonly relations: string[] = [];
}
