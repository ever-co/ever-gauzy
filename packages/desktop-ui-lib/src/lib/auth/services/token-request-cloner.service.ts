import { HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';

/**
 * Handles cloning HTTP requests with updated authentication tokens.
 * Single Responsibility: Request transformation logic.
 */
@Injectable({
	providedIn: 'root'
})
export class TokenRequestCloner {
	cloneWithToken<T>(request: HttpRequest<T>, token: string): HttpRequest<T> {
		if (!token) return request;
		return request.clone({
			setHeaders: { Authorization: `Bearer ${token}` }
		});
	}
}
