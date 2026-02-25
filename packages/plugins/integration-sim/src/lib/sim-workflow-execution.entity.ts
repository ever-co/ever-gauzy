import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsNumber } from 'class-validator';
import { JoinColumn, RelationId } from 'typeorm';
import { ID, IIntegrationTenant } from '@gauzy/contracts';
import {
	ColumnIndex,
	IntegrationTenant,
	MultiORMColumn,
	MultiORMEntity,
	MultiORMManyToOne,
	TenantOrganizationBaseEntity
} from '@gauzy/core';
import { MikroOrmSimWorkflowExecutionRepository } from './repository/mikro-orm-sim-workflow-execution.repository';

@MultiORMEntity('sim_workflow_execution', {
	mikroOrmRepository: () => MikroOrmSimWorkflowExecutionRepository
})
export class SimWorkflowExecution extends TenantOrganizationBaseEntity {
	@ApiProperty({ type: () => String })
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	workflowId!: string;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	executionId?: string;

	@ApiProperty({ type: () => String })
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	status!: string; // 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'

	@ApiPropertyOptional()
	@IsOptional()
	@MultiORMColumn({ type: 'json', nullable: true })
	input?: any;

	@ApiPropertyOptional()
	@IsOptional()
	@MultiORMColumn({ type: 'json', nullable: true })
	output?: any;

	@ApiPropertyOptional()
	@IsOptional()
	@MultiORMColumn({ type: 'json', nullable: true })
	error?: any;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true })
	duration?: number;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@MultiORMColumn({ nullable: true })
	triggeredBy?: string; // 'manual' | 'event' | 'api' | 'schedule'

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/
	/**
	 * Integration Tenant
	 */
	@MultiORMManyToOne(() => IntegrationTenant, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,
		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	integration?: IIntegrationTenant;

	/**
	 * Integration Tenant ID
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	@RelationId((it: SimWorkflowExecution) => it.integration)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	integrationId!: ID;
}
