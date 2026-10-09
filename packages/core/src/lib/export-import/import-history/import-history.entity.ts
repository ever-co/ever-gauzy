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

	/**
	 * No longer populated. It used to carry the storage URL of the uploaded archive — a full tenant
	 * data dump — which for the local provider was a guessable, unauthenticated `/public/` link. The
	 * archive is downloaded through `GET /import/history/:id/download` instead. Kept on the entity so
	 * the response shape does not change for existing clients.
	 */
	@VirtualMultiOrmColumn()
	public fullUrl?: string;
}
