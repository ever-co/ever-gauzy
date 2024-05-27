import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationId } from 'typeorm';
import { EntityRepositoryType } from '@mikro-orm/knex';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ISocialAccount, IUser } from '@gauzy/contracts';
import { TenantBaseEntity, User } from '../../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../../core/decorators/entity';
import { MicroOrmSocialAccountRepository } from './repository';

@MultiORMEntity('social_account', { mikroOrmRepository: () => MicroOrmSocialAccountRepository })
export class SocialAccount extends TenantBaseEntity implements ISocialAccount {
	[EntityRepositoryType]?: MicroOrmSocialAccountRepository;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	provider: string;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn()
	providerAccountId: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * User
	 */
	@MultiORMManyToOne(() => User, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	user?: IUser;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: SocialAccount) => it.user)
	@ColumnIndex()
	@MultiORMColumn({ relationId: true })
	userId?: IUser['id'];
}
