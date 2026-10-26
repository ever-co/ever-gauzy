import { HttpContextToken } from '@angular/common/http';

/**
 * Set on a request whose caller reports a failure to the user itself, so `ServerErrorInterceptor` does not also
 * show its generic toast for it (for a refused organization switch that toast would read "Unauthorized. Please
 * login again." although the session is fine). Detecting that the server is down is not affected.
 */
export const SKIP_ERROR_NOTIFICATION = new HttpContextToken<boolean>(() => false);
