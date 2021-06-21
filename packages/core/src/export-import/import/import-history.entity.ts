import { ApiProperty } from '@nestjs/swagger';
import { Entity, Column } from 'typeorm';
import { IsDate } from 'class-validator';
import { IImportHistory } from '@gauzy/contracts';
import { TenantBaseEntity } from '../../core/entities/internal';

@Entity('import-history')
export class ImportHistory extends TenantBaseEntity implements IImportHistory {

	@ApiProperty({ type: () => String })
	@Column({ nullable: false })
	file: string;

	@ApiProperty({ type: () => String })
	@Column({ nullable: true })
	size: string;

    @ApiProperty({ type: () => String })
	@Column({ nullable: false })
	status: string;

	@ApiProperty({ type: () => Date })
    @IsDate()
	@Column({ nullable: true })
	importDate: Date;
}