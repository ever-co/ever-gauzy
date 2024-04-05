import { ApiProperty } from '@nestjs/swagger';
import { IsDate } from 'class-validator';
import { IImportRecord } from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, VirtualMultiOrmColumn } from './../../core/decorators/entity';
import { TenantBaseEntity } from '../../core/entities/internal';
import { MikroOrmImportRecordRepository } from './repository/mikro-orm-import-record.repository';

@MultiORMEntity('import-record', { mikroOrmRepository: () => MikroOrmImportRecordRepository })
export class ImportRecord extends TenantBaseEntity implements IImportRecord {

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: false })
	entityType: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: false, type: 'uuid' })
	sourceId: string;

	@ApiProperty({ type: () => String })
	@MultiORMColumn({ nullable: false, type: 'uuid' })
	destinationId: string;

	@ApiProperty({ type: () => Date })
	@IsDate()
	@MultiORMColumn({ nullable: false, default: () => 'CURRENT_TIMESTAMP' })
	importDate?: Date;

	/** Additional virtual columns */
	@VirtualMultiOrmColumn()
	wasCreated?: boolean;
}
