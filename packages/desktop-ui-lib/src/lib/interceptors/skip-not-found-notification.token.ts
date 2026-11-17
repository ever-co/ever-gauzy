import { HttpContextToken } from '@angular/common/http';

/**
 * Set on a request whose caller takes a 404 for an answer (the record was deleted on the server), so
 * `ServerErrorInterceptor` does not show its generic error toast for that 404. Any other error of the request is still
 * reported, and detecting that the server is down is not affected.
 */
export const SKIP_NOT_FOUND_NOTIFICATION = new HttpContextToken<boolean>(() => false);
