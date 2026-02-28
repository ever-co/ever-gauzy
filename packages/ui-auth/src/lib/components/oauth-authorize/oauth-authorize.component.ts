import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { API_PREFIX } from '@gauzy/ui-core/common';

interface OAuthRequestInfo {
	clientId: string;
	scope?: string;
	redirectUri: string;
}

@Component({
	selector: 'ngx-oauth-authorize',
	templateUrl: './oauth-authorize.component.html',
	styleUrls: ['./oauth-authorize.component.scss'],
	standalone: false
})
export class OAuthAuthorizeComponent implements OnInit {
	requestId: string | null = null;
	requestInfo: OAuthRequestInfo | null = null;
	loading = true;
	approving = false;
	error: string | null = null;

	constructor(
		private readonly http: HttpClient,
		private readonly route: ActivatedRoute,
		private readonly router: Router
	) {}

	ngOnInit(): void {
		this.requestId = this.route.snapshot.queryParamMap.get('request_id');
		if (!this.requestId) {
			this.error = 'Missing authorization request ID.';
			this.loading = false;
			return;
		}
		this.loadRequestInfo();
	}

	/**
	 * Load the pending OAuth request details from the backend.
	 */
	private loadRequestInfo(): void {
		this.http
			.get<OAuthRequestInfo>(
				`${API_PREFIX}/integration/ever-gauzy/oauth/authorize/request/${this.requestId}`
			)
			.subscribe({
				next: (info) => {
					this.requestInfo = info;
					this.loading = false;
				},
				error: (err) => {
					if (err.status === 401) {
						// User not logged in — store request ID and redirect to login
						sessionStorage.setItem('oauth_pending_request_id', this.requestId!);
						this.router.navigate(['/auth/login']);
					} else {
						this.error = 'Authorization request not found or expired.';
						this.loading = false;
					}
				}
			});
	}

	/**
	 * User approves the OAuth authorization request.
	 */
	approve(): void {
		if (!this.requestId || this.approving) return;

		this.approving = true;
		this.http
			.post<{ redirect_url: string }>(
				`${API_PREFIX}/integration/ever-gauzy/oauth/authorize`,
				{ request_id: this.requestId }
			)
			.subscribe({
				next: (result) => {
					// Redirect to the third-party app with the authorization code
					window.location.href = result.redirect_url;
				},
				error: () => {
					this.approving = false;
					this.error = 'Failed to authorize. Please try again.';
				}
			});
	}

	/**
	 * User denies the OAuth authorization request.
	 */
	deny(): void {
		if (this.requestInfo?.redirectUri) {
			const url = new URL(this.requestInfo.redirectUri);
			url.searchParams.set('error', 'access_denied');
			url.searchParams.set('error_description', 'User denied the request');
			window.location.href = url.toString();
		} else {
			this.router.navigate(['/']);
		}
	}
}
