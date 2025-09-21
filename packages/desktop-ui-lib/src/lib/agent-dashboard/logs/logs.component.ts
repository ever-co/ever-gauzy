import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { LogEntry } from '../models/logs.models';
import { LogService } from '../services/logs.service';

@Component({
	selector: 'app-logs-page',
	templateUrl: './logs.component.html',
	styleUrls: ['./logs.component.scss'],
	standalone: false
})
export class LogsPageComponent {
	logs$: Observable<LogEntry[]> = this.svc.logsStream$;
	level: string = 'all';
	query: string = '';
	autoScroll = true;

	constructor(private svc: LogService) { }

	filter(logs: LogEntry[]): LogEntry[] {
		return logs.filter(l => {
			if (this.level !== 'all' && l.level !== this.level) return false;
			if (this.query && !l.msg.toLowerCase().includes(this.query.toLowerCase())) return false;
			return true;
		});
	}
}
