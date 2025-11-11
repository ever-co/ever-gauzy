import { Injectable } from "@angular/core";
import { UntilDestroy, untilDestroyed } from "@ngneat/until-destroy";
import { SocketConnectionService } from "../socket-connection";
import { BehaviorSubject, filter, fromEvent, switchMap, tap } from "rxjs";

@UntilDestroy()
@Injectable({
    providedIn: 'root'
})
export class TaskSocketService {
    public tasksChanged$ = new BehaviorSubject<boolean>(false);

    constructor(private readonly socketConnection: SocketConnectionService) {
        this.listenToTasksChanges();
    }

    /**
     * Listen to tasks changes from the socket connection
     */
    private listenToTasksChanges() {
        console.log(this.socketConnection?.socket);
        this.socketConnection.connected$
            .pipe(
                filter((connected) => connected === true),
                switchMap(() =>
                   fromEvent(this.socketConnection.socket, 'tasks:changed').pipe(
                    tap(() => {
                        console.log('[Socket] tasks:changed event');
                        this.tasksChanged$.next(true);
                    })
                   )
                ),
                untilDestroyed(this)
            )
            .subscribe();
    }
}
