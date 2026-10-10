import { Type } from '@nestjs/common';
import { DateTimeScalar } from './date-time.scalar';
import { DecimalScalar } from './decimal.scalar';
import { JsonScalar } from './json.scalar';

export * from './date-time.scalar';
export * from './decimal.scalar';
export * from './json.scalar';

/**
 * The three scalars the kernel schema declares.
 *
 * They are providers of the module the Apollo configuration names as its resolver host, which is how
 * a `@Scalar()` class is found in a schema-first build: the driver scans the included modules for
 * providers carrying the scalar metadata and merges them into the resolver map. A scalar declared in
 * the SDL and provided by no scanned module is not an error — graphql-js gives it a pass-through
 * implementation and the schema keeps validating — which is why all three went unimplemented without
 * a symptom anyone could see.
 */
export const CORE_SCALARS: Array<Type<unknown>> = [DecimalScalar, DateTimeScalar, JsonScalar];
