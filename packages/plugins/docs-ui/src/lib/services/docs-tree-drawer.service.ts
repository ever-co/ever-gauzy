import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Open/closed state of the Documents folder drawer.
 *
 * The drawer lives in the shell, but its trigger lives in each page's own header
 * (browse, page editor, file view, review) — so the trigger takes no column of
 * its own. This service is the one channel between them.
 */
@Injectable({ providedIn: 'root' })
export class DocsTreeDrawerService {
	private readonly openSubject = new BehaviorSubject<boolean>(false);

	/** Emits the current state first, then every change. */
	readonly open$: Observable<boolean> = this.openSubject.asObservable();

	get isOpen(): boolean {
		return this.openSubject.value;
	}

	open(): void {
		if (!this.isOpen) this.openSubject.next(true);
	}

	close(): void {
		if (this.isOpen) this.openSubject.next(false);
	}

	toggle(): void {
		this.openSubject.next(!this.isOpen);
	}
}
