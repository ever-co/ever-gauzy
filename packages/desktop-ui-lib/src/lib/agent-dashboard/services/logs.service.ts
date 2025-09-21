import { Injectable } from '@angular/core';
import { BehaviorSubject, interval } from 'rxjs';
import { LogEntry, LogLevel, QueueItem, SyncHealth } from '../models/logs.models';

@Injectable({ providedIn: 'root' })
export class LogService {
  private logs$ = new BehaviorSubject<LogEntry[]>(this.mockLogs());
  private queue$ = new BehaviorSubject<QueueItem[]>(this.mockQueue());
  private health$ = new BehaviorSubject<SyncHealth>({ queueLength: 5, lastSuccessAt: new Date().toISOString(), apiReachable: true });

  logsStream$ = this.logs$.asObservable();
  queueStream$ = this.queue$.asObservable();
  healthStream$ = this.health$.asObservable();

  constructor(){
    // Simulate log stream
    interval(2000).subscribe(()=>{
      const levels: LogLevel[] = ['DEBUG','INFO','WARN','ERROR'];
      const lvl = levels[Math.floor(Math.random()*4)];
      const newLog: LogEntry = { id: 'log_'+Date.now(), ts: new Date().toISOString(), level: lvl, msg: lvl==='INFO'? 'Worker heartbeat ok' : 'Console sample ' + Math.floor(Math.random()*1000)};
      const arr = [...this.logs$.value, newLog];
      if(arr.length>600) arr.shift();
      this.logs$.next(arr);
    });
  }

  retryQueueItem(id: string){
    const arr = [...this.queue$.value];
    const it = arr.find(x=>x.id===id);
    if(it){
      it.retries += 1;
      if(it.retries>=2){ it.status = 'SYNCED'; this.health$.next({ ...this.health$.value, lastSuccessAt: new Date().toISOString() }); }
      this.queue$.next(arr);
    }
  }

  clearSynced(){
    this.queue$.next(this.queue$.value.filter(x=>x.status!=='SYNCED'));
  }

  private mockLogs(): LogEntry[] {
    const now=Date.now();
    return Array.from({length:120}, (_,i)=>{
      const lvl: LogLevel = ['DEBUG','INFO','WARN','ERROR'][i%4] as LogLevel;
      return { id:'log_'+i, ts:new Date(now - i*4000).toISOString(), level:lvl, msg: lvl==='ERROR'? 'Unhandled exception at module X line '+(i%50): lvl==='WARN'? 'Memory usage high: '+(50+i%40)+'%': lvl==='INFO'? 'Job tick '+(20+i%80)+'ms': 'Debug trace value='+i };
    });
  }

  private mockQueue(): QueueItem[] {
    const now=Date.now();
    return Array.from({length:10}, (_,i)=>({ id:'q_'+i, createdAt:new Date(now - i*5*60000).toISOString(), type: i%2===0? 'screenshot':'window', sizeBytes: i%2===0? 220000+i*10000: undefined, retries: i%3, status: i%4===0? 'FAILED' : i%5===0? 'SYNCED' : 'PENDING', errorMessage: i%4===0? 'Network timeout': undefined }));
  }
}
