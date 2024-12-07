import { IEmployee, IGoal, IKPI, IOrganizationProject, ITask } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { KeyResultUpdate } from '../../core/entities/internal';

export abstract class KeyresultDTO {
	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly name: string;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly description: string;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly type: string;

	@ApiProperty({ type: () => Number, readOnly: true })
	@IsOptional()
	@IsNumber()
	readonly targetValue: number;

	@ApiProperty({ type: () => Number, readOnly: true })
	@IsOptional()
	@IsNumber()
	readonly initialValue: number;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly unit: string;

	@ApiProperty({ type: () => Number, readOnly: true })
	@IsOptional()
	@IsNumber()
	readonly update: number;

	@ApiProperty({ type: () => Number, readOnly: true })
	@IsOptional()
	@IsNumber()
	readonly progress: number;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly deadline: string;

	@ApiProperty({ type: () => Date, readOnly: true })
	@IsOptional()
	readonly hardDeadline: Date;

	@ApiProperty({ type: () => Date, readOnly: true })
	@IsOptional()
	readonly softDeadline: Date;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly status: string;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly weight: string;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly ownerId: string;

	@ApiProperty({ type: () => Object, readOnly: true })
	@IsOptional()
	@IsObject()
	readonly owner: IEmployee;

	@ApiProperty({ type: () => Object, readOnly: true })
	@IsOptional()
	@IsObject()
	readonly lead: IEmployee;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly leadId: string;

	@ApiProperty({ type: () => Object, readOnly: true })
	@IsOptional()
	@IsObject()
	readonly project: IOrganizationProject;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly projectId: string;

	@ApiProperty({ type: () => Object, readOnly: true })
	@IsOptional()
	@IsObject()
	readonly task: ITask;

	@ApiProperty({ type: () => Object, readOnly: true })
	@IsOptional()
	@IsObject()
	readonly kpi: IKPI;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly kpiId: string;

	@ApiProperty({ type: () => Object, readOnly: true })
	@IsOptional()
	@IsObject()
	readonly goal: IGoal;

	@ApiProperty({ type: () => String, readOnly: true })
	@IsOptional()
	@IsString()
	readonly goalId: string;

	@ApiProperty({ type: () => Object, isArray: true, readOnly: true })
	@IsOptional()
	readonly updates: KeyResultUpdate[];
}
