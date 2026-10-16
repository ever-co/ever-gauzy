import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { maskSecret } from '../../core/decorators/is-secret';
import { TenantSetting } from './tenant-setting.entity';
import { isSecretTenantSettingName } from './tenant-setting.utils';

/** How far into an answer rows are looked for: a page (`items`), a connection (`nodes`, `edges[].node`). */
const MAX_DEPTH = 4;

/**
 * Whether a plain object is a SERIALIZED settings row: what the MikroORM CRUD path answers (`wrap(entity).toJSON()`),
 * which is no `TenantSetting` instance. A row carries its id, its name, its value and its tenant together; a settings
 * document — a map of setting names to values — does not (review on #10652).
 *
 * @param value A plain object from an answer.
 */
function isSerializedSettingRow(value: Record<string, unknown>): boolean {
	return (
		typeof value['id'] === 'string' &&
		typeof value['name'] === 'string' &&
		Object.prototype.hasOwnProperty.call(value, 'value') &&
		Object.prototype.hasOwnProperty.call(value, 'tenantId')
	);
}

/**
 * One settings row as a client may see it: a secret's `value` / `valueJson` masked, every other row as stored.
 *
 * The secret rule is the default-deny one the CSV export and the settings document already use
 * ({@link isSecretTenantSettingName}): a name not on the allowlist of plain settings is a secret. The row is
 * copied, never changed in place, so nothing the service still holds is altered.
 *
 * @param row The stored row.
 * @returns The row to answer.
 */
export function maskTenantSettingSecrets(row: TenantSetting): TenantSetting {
	if (!row || !isSecretTenantSettingName(row.name)) {
		return row;
	}

	const masked = Object.assign(Object.create(Object.getPrototypeOf(row)), row) as TenantSetting;

	if (masked.value !== undefined && masked.value !== null && masked.value !== '') {
		masked.value = maskSecret(masked.value);
	}
	if (masked.valueJson !== undefined && masked.valueJson !== null) {
		masked.valueJson = maskSecret(typeof masked.valueJson === 'string' ? masked.valueJson : JSON.stringify(masked.valueJson));
	}

	return masked;
}

/**
 * An answer with every settings row in it masked: a row, a list, a page or a connection.
 *
 * Only settings rows are touched — `TenantSetting` instances, and the serialized rows the MikroORM path answers — so
 * the key/value documents the routes answer, masked by their own handlers, pass through as they are.
 *
 * @param answer What a route or a field answered.
 * @param depth How deep into the answer this is.
 */
export function maskTenantSettingRows(answer: unknown, depth = 0): unknown {
	if (answer === null || typeof answer !== 'object' || depth > MAX_DEPTH) {
		return answer;
	}

	if (answer instanceof TenantSetting) {
		return maskTenantSettingSecrets(answer);
	}

	if (Array.isArray(answer)) {
		return answer.map((item) => maskTenantSettingRows(item, depth + 1));
	}

	if (Object.getPrototypeOf(answer) !== Object.prototype) {
		return answer;
	}

	if (isSerializedSettingRow(answer as Record<string, unknown>)) {
		return maskTenantSettingSecrets(answer as TenantSetting);
	}

	return Object.fromEntries(Object.entries(answer).map(([key, value]) => [key, maskTenantSettingRows(value, depth + 1)]));
}

/**
 * Masks the secret settings in everything the tenant-setting routes and fields answer (SEC-A-06).
 *
 * The settings document (`GET /tenant-setting`, `tenantSettingValues`) was masked by its handler, but every
 * surface that answers ROWS answered the stored value: `tenantSettings`, `tenantSetting`, the row edit and the
 * soft-delete pair over GraphQL, and `GET /tenant-setting/:id`, `/pagination` and the soft-delete pair over REST
 * — the S3 / Wasabi / DigitalOcean secret keys, the Cloudinary API secret and the monitoring keys in cleartext to
 * anyone holding `TENANT_SETTING`. One interceptor on both classes covers every route and field, inherited ones
 * included, and any added later.
 */
@Injectable()
export class MaskTenantSettingSecretsInterceptor implements NestInterceptor {
	intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
		return next.handle().pipe(map((answer) => maskTenantSettingRows(answer)));
	}
}
