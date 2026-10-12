import { RequestMethod, Type } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PUBLIC_METHOD_METADATA } from '@gauzy/constants';

/** A route that answers without authentication. */
export interface PublicRoute {
	method: string;
	path: string;
}

const join = (...parts: string[]) =>
	'/' +
	parts
		.flatMap((part) => part.split('/'))
		.filter((segment) => segment.length > 0)
		.join('/');

/**
 * Every `@Public()` route of `controllers`, as Nest registers them under the `/api` prefix, read from
 * the same metadata Nest's router reads (controller path, handler path and method).
 */
export function collectPublicRoutes(controllers: Array<Type<unknown>>, prefix = '/api'): PublicRoute[] {
	const routes: PublicRoute[] = [];
	for (const controller of controllers) {
		const classPublic = Reflect.getMetadata(PUBLIC_METHOD_METADATA, controller) === true;
		const base = String(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
		let prototype = controller.prototype;
		const seen = new Set<string>();
		while (prototype && prototype !== Object.prototype) {
			for (const name of Object.getOwnPropertyNames(prototype)) {
				if (name === 'constructor' || seen.has(name)) continue;
				seen.add(name);
				const handler = Object.getOwnPropertyDescriptor(prototype, name)?.value;
				if (typeof handler !== 'function' || Reflect.getMetadata(PATH_METADATA, handler) === undefined) continue;
				const isPublic = classPublic || Reflect.getMetadata(PUBLIC_METHOD_METADATA, handler) === true;
				if (!isPublic) continue;
				const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number] ?? 'GET';
				const paths = ([] as string[]).concat(Reflect.getMetadata(PATH_METADATA, handler));
				for (const path of paths) {
					routes.push({ method, path: join(prefix, base, String(path)) });
				}
			}
			prototype = Object.getPrototypeOf(prototype);
		}
	}
	return routes.sort((a, b) => (a.path + a.method < b.path + b.method ? -1 : 1));
}
