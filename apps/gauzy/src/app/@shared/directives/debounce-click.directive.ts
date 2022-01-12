import { 
    Directive, 
    EventEmitter, 
    HostListener, 
    Input, 
    OnDestroy, 
    OnInit, 
    Output 
} from '@angular/core';
import { Subject, Subscription, tap } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
  
@Directive({
	selector: '[debounceClick]'
})
export class DebounceClickDirective implements OnInit, OnDestroy {
    @Input() debounceTime = 300;
  
    @Output() throttledClick = new EventEmitter();
    
    private clicks = new Subject();
    private subscription: Subscription;
  
    constructor() {}
  
    ngOnInit() {
		this.subscription = this.clicks
			.pipe(
				debounceTime(this.debounceTime),
				tap((e) => this.throttledClick.emit(e))
			)
			.subscribe();
	}
  
    ngOnDestroy() {
      	this.subscription.unsubscribe();
    }
  
    @HostListener('click', ['$event'])
    clickEvent(event) {
		event.preventDefault();
		event.stopPropagation();
		this.clicks.next(event);
    }
}