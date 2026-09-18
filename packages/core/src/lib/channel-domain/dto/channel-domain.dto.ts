import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	MinLength,
	ValidateNested
} from 'class-validator';
import { ID, JsonData } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { parseToBoolean } from '@gauzy/utils';

/**
 * What a caller states when it binds a hostname to a channel.
 *
 * `channelId` and `hostname` are both required: one names the channel the host belongs to and the
 * other is the host. The hostname is validated as text rather than as a hostname — the normaliser
 * the service owns is what decides whether a value is one, and it is the same normaliser the
 * resolution path runs, so a value accepted here is stored in exactly the form a request will be
 * probed with. A second check in the DTO would be a second answer to "is this a host".
 *
 * The three flags carry their column defaults when they are absent, so a plain binding is a primary,
 * TLS-served, non-redirecting host.
 */
export class CreateChannelDomainDTO extends TenantOrganizationBaseDTO {
	/**
	 * The channel the hostname resolves to.
	 */
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly channelId: ID;

	/**
	 * The hostname, as the caller states it: lower-cased and stripped of any scheme or path by the
	 * service before it is stored.
	 */
	@ApiProperty({ type: () => String, maxLength: 255 })
	@IsString()
	@MinLength(1)
	@MaxLength(255)
	readonly hostname: string;

	/**
	 * Whether this is the channel's canonical host. The channel's first hostname is made primary
	 * whatever the body says.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: true })
	@IsOptional()
	@IsBoolean()
	readonly isPrimary?: boolean;

	/**
	 * Whether the host is served over TLS. Defaults to true, the column's own default.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: true })
	@IsOptional()
	@IsBoolean()
	readonly isSslEnabled?: boolean;

	/**
	 * Whether a request to this host is redirected to the channel's primary host.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@IsBoolean()
	readonly redirectToPrimary?: boolean;

	/**
	 * Tenant extras: the certificate reference, a content-delivery identifier.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * What a caller may change on a hostname that exists.
 *
 * The hostname itself and the channel it belongs to are absent: a binding that could be re-pointed is
 * a binding whose resolution changes under the requests that already resolved it, so rebinding is an
 * unbind followed by a bind. Setting `isPrimary` here moves the flag from the current holder — an
 * update is the deliberate operation, so it is not refused for the reason a create is.
 */
export class UpdateChannelDomainDTO extends TenantOrganizationBaseDTO {
	/**
	 * Whether this is the channel's canonical host.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isPrimary?: boolean;

	/**
	 * Whether the host is served over TLS.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isSslEnabled?: boolean;

	/**
	 * Whether requests to this host are redirected to the primary.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly redirectToPrimary?: boolean;

	/**
	 * Tenant extras, replaced whole.
	 */
	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly metadata?: JsonData;
}

/**
 * The filterable members of the hostname list, in the flat spelling.
 */
export class ChannelDomainFilterDTO {
	/**
	 * Restrict to the hostnames of one channel.
	 */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly channelId?: ID;

	/**
	 * Restrict to one hostname.
	 */
	@ApiPropertyOptional({ type: () => String, maxLength: 255 })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	readonly hostname?: string;

	/**
	 * Restrict to the channel's canonical host, or to the ones that redirect to it.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	@IsBoolean()
	readonly isPrimary?: boolean;
}

/**
 * The query of `GET /channel-domains`.
 *
 * Both spellings of the same filter are accepted, as on every list route of this platform: the flat
 * one and the bracketed one the endpoint table names.
 */
export class ChannelDomainQueryDTO extends ChannelDomainFilterDTO {
	/**
	 * The bracketed spelling of the same members.
	 */
	@ApiPropertyOptional({ type: () => ChannelDomainFilterDTO })
	@IsOptional()
	@ValidateNested()
	@Type(() => ChannelDomainFilterDTO)
	readonly filter?: ChannelDomainFilterDTO;

	/**
	 * How many hostnames to answer with.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 1, maximum: 100 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	readonly take?: number;

	/**
	 * How many hostnames to skip.
	 */
	@ApiPropertyOptional({ type: () => Number, minimum: 0 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	readonly skip?: number;
}

/**
 * The query of `DELETE /channel-domains/:id`.
 *
 * `force` is the member that changes what the route does, and here it is the difference between a
 * refusal and a removal: the last hostname of a channel is refused, because a channel no request can
 * resolve to cannot serve — invariant I-25. A caller that states `force` accepts that consequence.
 */
export class DeleteChannelDomainQueryDTO {
	/**
	 * Whether the caller accepts removing the channel's last hostname.
	 */
	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@IsOptional()
	@Transform(({ value }: TransformFnParams) => parseToBoolean(value))
	@IsBoolean()
	readonly force?: boolean;
}

/**
 * The query of a hostname list, as the service's own find input states it.
 *
 * Declared here as well as in the DTO because the service narrows in the store and the two spellings
 * are folded into one before the call: a caller that states the bracketed spelling and a caller that
 * states the flat one must reach the same read.
 */
export interface IChannelDomainListFilter {
	readonly channelId?: ID;
	readonly hostname?: string;
	readonly isPrimary?: boolean;
}
