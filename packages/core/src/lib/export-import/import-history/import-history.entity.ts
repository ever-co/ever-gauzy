import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { Exclude } from 'class-transformer';
import { IImportHistory, ImportStatusEnum } from '@gauzy/contracts';
import { TenantBaseEntity } from '../../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, VirtualMultiOrmColumn } from '../../core/decorators/entity';
import { MikroOrmImportHistoryRepository } from './repository/mikro-orm-import-history.repository';

@MultiORMEntity('import-history', { mikroOrmRepository: () => MikroOrmImportHistoryRepository })
export class ImportHistory extends TenantBaseEntity implements IImportHistory {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn()
	file: string;

	@Exclude({ toPlainOnly: true })
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn()
	path: string;

	@ApiPropertyOptional({ type: () => Number })
	@IsOptional()
	@IsNumber()
	@MultiORMColumn({ nullable: true })
	size: number;

	@ApiProperty({ type: () => String, enum: ImportStatusEnum })
	@IsNotEmpty()
	@IsEnum(ImportStatusEnum)
	@MultiORMColumn()
	status: ImportStatusEnum;

	@ApiPropertyOptional({ type: () => Date })
	@IsOptional()
	@IsDate()
	@MultiORMColumn({ default: () => 'CURRENT_TIMESTAMP' })
	importDate?: Date;

	/** Additional virtual columns */
	@VirtualMultiOrmColumn()
	public fullUrl?: string;
}
