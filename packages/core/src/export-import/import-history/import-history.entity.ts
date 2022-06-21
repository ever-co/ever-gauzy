import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column } from 'typeorm';
import { IsDate } from 'class-validator';
import { Exclude } from 'class-transformer';
import { IImportHistory } from '@gauzy/contracts';
import { TenantBaseEntity } from '../../core/entities/internal';

@Entity('import-history')
export class ImportHistory extends TenantBaseEntity implements IImportHistory {

	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	file: string;

	@Exclude()
	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	path: string;

	@ApiProperty({ type: () => Number })
	@Column({ nullable: true })
	size: number;

    @ApiProperty({ type: () => String })
	@Column({ nullable: false })
	status: string;

	@ApiProperty({ type: () => Date })
    @IsDate()
	@Column({ nullable: false, default: () => 'CURRENT_TIMESTAMP'})
	importDate?: Date;

	fullUrl?: string;
}