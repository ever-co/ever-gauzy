import { Inject } from '@nestjs/common';

/**
 * Creates a decorator that can be used as a convenience to inject a specific token
 *
 * Instead of using @Inject(SOME_THING_TOKEN) this can be used to create a new named Decorator
 * such as @InjectSomeThing() which will hide the token details from users making APIs easier
 * to consume
 * @param token
 */
export const makeInjectableDecorator =
  (token: string | symbol): (() => ParameterDecorator) =>
  () =>
    Inject(token);
