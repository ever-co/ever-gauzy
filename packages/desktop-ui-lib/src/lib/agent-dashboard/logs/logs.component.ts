import { Component, ViewChild, ElementRef, AfterViewChecked, OnDestroy, HostListener } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { LogEntry } from '../models/logs.models';
import { LogService } from '../services/logs.service';

@Component({
	selector: 'app-logs-page',
	templateUrl: './logs.component.html',
	styleUrls: ['./logs.component.scss'],
	standalone: false
})
export class LogsPageComponent implements AfterViewChecked, OnDestroy {
	@ViewChild('logContainer') private logContainer: ElementRef;
	logs$: Observable<LogEntry[]> = this.svc.logsStream$;
	level: string = 'all';
	query: string = '';
	autoScroll = true;
	private logsSubscription: Subscription;
	isUserScrolling = false;

	constructor(private svc: LogService) {
		this.logsSubscription = this.logs$.subscribe(() => {
			if (this.autoScroll && !this.isUserScrolling) {
				this.scrollToBottom();
			}
		});
	}

	ngAfterViewChecked() {
		if (this.autoScroll && !this.isUserScrolling) {
			this.scrollToBottom();
		}
	}

	ngOnDestroy() {
		if (this.logsSubscription) {
			this.logsSubscription.unsubscribe();
		}
	}

	scrollToBottom(): void {
		try {
			this.logContainer.nativeElement.scrollTop = this.logContainer.nativeElement?.scrollHeight;
		} catch (err) {
			console.log('error on scrool', err);
		}
	}

	filter(logs: LogEntry[]): LogEntry[] {
		return logs.filter(l => {
			if (this.level !== 'all' && l.level !== this.level) return false;
			if (this.query && !l.msg.toLowerCase().includes(this.query.toLowerCase())) return false;
			return true;
		});
	}
}
