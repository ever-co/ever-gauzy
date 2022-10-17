import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
    selector: 'gauzy-all-team',
    templateUrl: './all-team.component.html',
    styleUrls: ['./all-team.component.scss']
})
export class AllTeamComponent implements OnInit {
    @Input()
    teams: any[];
    @Input()
    organization: any;

    @Output()
    selectedTeam: EventEmitter<any> = new EventEmitter()

    constructor() {
    }

    ngOnInit(): void {
    }

    onSelectTeam(team: any) {
        this.selectedTeam.emit(team);
    }
}
