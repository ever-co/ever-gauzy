import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntityRepositoryType } from '@mikro-orm/core';
import { JoinColumn, RelationId } from 'typeorm';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { isMySQL, isPostgres } from '@gauzy/config';
import { IApiCallLog, ID, IUser, JsonData, RequestMethod } from '@gauzy/contracts';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '../core/decorators/entity';
import { TenantOrganizationBaseEntity, User } from '../core/entities/internal';
import { MikroOrmApiCallLogRepository } from './repository/mikro-orm-api-call-log.repository';

@MultiORMEntity('api_call_log', { mikroOrmRepository: () => MikroOrmApiCallLogRepository })
export class ApiCallLog extends TenantOrganizationBaseEntity implements IApiCallLog {
	[EntityRepositoryType]?: MikroOrmApiCallLogRepository;

	/**
	 * Correlation ID to track the request across services
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@ColumnIndex()
	@MultiORMColumn()
	correlationId: ID;

	/**
	 * The request URL that was called
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	url: string;

	/**
	 * The HTTP method (GET, POST, etc.) used in the request
	 */
	@ApiProperty({ enum: RequestMethod })
	@IsNotEmpty()
	@IsEnum(RequestMethod)
	@ColumnIndex()
	@MultiORMColumn()
	method: RequestMethod;

	/**
	 * Request headers stored as JSON string
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text' })
	requestHeaders: JsonData;

	/**
	 * Request body stored as JSON string
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text' })
	requestBody: JsonData;

	/**
	 * Response body stored as JSON string
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@MultiORMColumn({ type: isPostgres() ? 'jsonb' : isMySQL() ? 'json' : 'text' })
	responseBody: JsonData;

	/**
	 * The HTTP status code returned from the request
	 */
	@ApiProperty({ type: () => Number })
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	statusCode: number;

	/**
	 * The timestamp when the request was initiated
	 */
	@ApiProperty({ type: () => Date })
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	requestTime: Date;

	/**
	 * The timestamp when the response was completed
	 */
	@ApiProperty({ type: () => Date })
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
	responseTime: Date;

	/**
	 * IP Address of the client making the request
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	ipAddress: string;

	/**
	 * The protocol used in the request (HTTP, HTTPS)
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	protocol: string;

	/**
	 * User-Agent string of the client making the request.
	 * This could be a browser, desktop app, Postman, or any other API client.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	userAgent: string;

	/**
	 * Origin from where the request was initiated (web, mobile, desktop, etc.).
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@MultiORMColumn({ nullable: true })
	origin: string; // Added column to track request origin

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 * User who performed the action, if applicable.
	 *
	 * This relationship is nullable and uses the User entity.
	 */
	@MultiORMManyToOne(() => User, {
		/** Indicates if the relation column value can be nullable or not. */
		nullable: true,

		/** Database cascade action on delete. */
		onDelete: 'CASCADE'
	})
	@JoinColumn()
	user?: IUser;

	/**
	 * The ID of the user who performed the action.
	 * This column stores the user ID as a foreign key, if applicable.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	@RelationId((it: ApiCallLog) => it.user)
	@ColumnIndex()
	@MultiORMColumn({ nullable: true, relationId: true })
	userId?: ID;
}
