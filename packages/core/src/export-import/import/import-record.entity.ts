import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column, ManyToOne } from 'typeorm';
import { IsDate } from 'class-validator';
import { IImportHistory, IImportRecord } from '@gauzy/contracts';
import { ImportHistory, TenantBaseEntity } from '../../core/entities/internal';

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

	@ManyToOne(() => ImportHistory, (history) => history.records, {
        onDelete: 'CASCADE',
    })
	history: IImportHistory;
}