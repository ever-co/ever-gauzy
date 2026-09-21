import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { PromotionActionDTO } from '../../promotion-action/dto';

/**
 * The body of `PUT /promotions/:id/actions`.
 *
 * **The route used to declare its body as an inline type literal**, which means class-validator never
 * ran on it and nothing was whitelisted: every member a caller sent reached the service and was spread
 * into a `create`, including a primary key — and `CrudService.create` is an upsert when the payload
 * carries one, on both ORMs, with no tenant predicate. The service strips the key as well, because a
 * validated body and a defensive write are two different guarantees and this write is worth both.
 *
 * `ValidateNested` with an explicit `Type` is what makes the element class actually validate: without
 * the transformer's type hint, class-validator sees plain objects and passes them all.
 */
export class ReplacePromotionActionsDTO {
	/** The new action set, in the order it is to be applied. */
	@ApiProperty({ type: () => [PromotionActionDTO] })
	@IsArray()
	@ArrayNotEmpty()
	@ValidateNested({ each: true })
	@Type(() => PromotionActionDTO)
	readonly actions: PromotionActionDTO[];
}

/**
 * The body of `POST /promotions/:id/deactivate`.
 *
 * The reason is optional and is kept with the promotion, because "why was this offer pulled" is asked
 * months later by someone who was not in the room. It is a DTO rather than an inline literal so the
 * route can whitelist its body like every other write on this controller.
 */
export class DeactivatePromotionDTO {
	/** Why the promotion is being stopped. */
	@ApiPropertyOptional({ type: () => String, maxLength: 512 })
	@IsOptional()
	@IsString()
	@MaxLength(512)
	readonly reason?: string;
}
