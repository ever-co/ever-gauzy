import { Type } from '@nestjs/common';

/**
 * The same class, without the field defaults its constructor would put on a new instance.
 *
 * Every mapped type of `@nestjs/mapped-types` and `@nestjs/swagger` (`PartialType`, `PickType`, `OmitType`,
 * `IntersectionType`) builds a class whose constructor runs `inheritPropertyInitializers`: it instantiates the
 * parent DTO and copies each field initializer it finds onto the new instance. A plain `extends` of a DTO with
 * initializers does the same through the constructor chain. A `ValidationPipe` builds a request body with
 * `plainToInstance`, which calls that constructor - so an update body that names one field reaches the service with
 * every defaulted field of the create DTO as well, and the service writes the defaults back over the stored values.
 * `PUT /api/payment-collections/:id {metadata}` zeroed the collection's money totals that way (review R3-04).
 *
 * The class returned here extends `Base`, so the validation, transformation and OpenAPI metadata a request is checked
 * and documented against are `Base`'s own, read through the prototype chain exactly as a plain `extends` reads them.
 * Its constructor lets `Base` run and then removes what that left on the instance, so `new Body()` is empty and
 * `plainToInstance` fills it with what the client sent and nothing else. Fields the update class declares itself are
 * initialized after this constructor returns, so a default the update class states on purpose is kept.
 *
 * Use it for every request body that updates a record:
 *
 * ```ts
 * export class UpdateXDTO extends WithoutInitializers(PartialType(CreateXDTO)) {}
 * ```
 *
 * `tools/scripts/update-dto-initializer-check.mjs` fails the build when an update body would carry a default.
 *
 * @param Base The class an update body extends: a mapped type or a DTO.
 * @returns A subclass of `Base` whose instances start empty.
 */
export function WithoutInitializers<TBase extends Type<any>>(Base: TBase): TBase {
	class WithoutInitializersType extends Base {
		constructor(...args: any[]) {
			super(...args);
			for (const key of Object.getOwnPropertyNames(this)) {
				delete (this as Record<string, unknown>)[key];
			}
		}
	}

	// The mapped types name their class after the one they map (`PartialCreateXDTO`); keep that name so nothing that
	// reads it - an error message, the OpenAPI document - sees a different one.
	Object.defineProperty(WithoutInitializersType, 'name', { value: Base.name });

	return WithoutInitializersType;
}
