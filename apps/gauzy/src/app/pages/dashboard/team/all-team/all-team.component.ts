import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
    selector: 'gauzy-all-team',
    templateUrl: './all-team.component.html',
    styleUrls: ['./all-team.component.scss']
})
export class AllTeamComponent implements OnInit {
    @Input()
    public teams: any[];
    @Input()
    public organization: any;

    @Output()
    public selectedTeam: EventEmitter<any> = new EventEmitter()

    constructor() {
    }

    ngOnInit(): void {
    }

    public onSelectTeam(team: any) {
        this.selectedTeam.emit(team);
    }
}
