import { ApiProperty, IntersectionType, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { Task } from './../task.entity';

/**
 * The human key of one task, as the path of `GET /tasks/by-number/:prefix/:number` carries it.
 *
 * The prefix is what the create handler stamps from the project's name and the number is one above that
 * project's highest, so the two together are what a person reads off a board (`FUL-12`).
 */
export class TaskByNumberParamsDTO {
	@ApiProperty({ type: () => String, example: 'FUL' })
	@IsNotEmpty()
	@IsString()
	@MaxLength(255)
	readonly prefix: string;

	@ApiProperty({ type: () => Number, example: 12 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	readonly number: number;
}

/**
 * The scope of the same read: the organization, checked against the caller's memberships, and the project
 * that disambiguates a prefix two projects share.
 */
export class TaskByNumberQueryDTO extends IntersectionType(TenantOrganizationBaseDTO, PickType(Task, ['projectId'])) {}
