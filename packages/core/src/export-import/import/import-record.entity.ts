import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column } from 'typeorm';
import { IsDate } from 'class-validator';
import { IImportRecord } from '@gauzy/contracts';
import { TenantBaseEntity } from '../../core/entities/internal';

@Entity('import-record')
export class ImportRecord extends TenantBaseEntity implements IImportRecord {

	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	entityType: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: false, type: 'uuid' })
	sourceId: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: false, type: 'uuid' })
	destinationId : string;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@Column({ nullable: true })
	importDate: Date;
}