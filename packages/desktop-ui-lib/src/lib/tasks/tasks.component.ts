import { Component, Input, OnInit, ChangeDetectorRef, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { TimeTrackerService } from '../time-tracker/time-tracker.service';
const log = window.require('electron-log');
console.log = log.log;
Object.assign(console, log.functions);


@Component({
	selector: 'ngx-tasks',
    changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './tasks.component.html',
	styleUrls: ['./tasks.component.scss']
})
export class TasksComponent
	implements OnInit {
    @Input() userData: any;
    @Input() employee: any;
    @Output() isAddTask = new EventEmitter<boolean>();
    @Output() newTaskCallback = new EventEmitter<any>();

	form: FormGroup;
	projectSelect =  null;
    projects = [];

    statusTaskSelect = null
    statuses = [
        {
            id:'todo',
            name: 'Todo',
        },
        {
            id:'In Progress',
            name:'In Progress'
        },
        {
            id : 'For Testing',
            name: 'For Testing',
        },
        {
            id :'Completed',
            name: 'Completed' 
        }
    ] 

    employeeSelect = null
    employees = []

    selectedTags = null
    tags = []

    dueDate = null;
    title = '';
    description = '';

    disableSave = true;

	constructor(
		private fb: FormBuilder,
        private _cdr: ChangeDetectorRef,
        private timeTrackerService: TimeTrackerService,
	) {}

	ngOnInit() {
        this.getProjects(this.userData);
        this.getTags(this.userData)
        this.getEmployees(this.userData);
        this.employeeSelect = this.userData.employeeId;
        this._cdr.detectChanges();
	}

    setProject(event) {
        this.projectSelect = event;
        this.validation();
    }
    setStatusTask(event) {
        this.statusTaskSelect = event;
        this.validation();
    }
    setEmployee(event) {

    }
    setTags(event) {
    }

    async getProjects(arg) {
        try {
            this.projects = await this.timeTrackerService.getProjects(arg);
            this._cdr.detectChanges();
        } catch (error) {
        }
	}

    async getTags(arg) {
        try {
            const tagsRes = await this.timeTrackerService.getTags(arg);
            this.tags = tagsRes.items;
            this._cdr.detectChanges();
        } catch (error) {
            console.log('error while get tags', error.message);
        }
    }

    async getEmployees(arg) {
        try {
            const employees = await this.timeTrackerService.getEmployees(arg);
            this.employees = employees.items;
            this._cdr.detectChanges();
        } catch (error) {
        }
    }

    closeAdd() {
        this.isAddTask.emit(false);
        this._cdr.detectChanges();
    }

    validation() {
        if (
            !this.title || !this.projectSelect
            || !this.statusTaskSelect || !this.dueDate
        ) {
            this.disableSave = true;
        } else {
            this.disableSave = false;
        }
    }

    async saveTask() {
        const payloadTask = {
            title: this.title,
            project: this.projects.find((i) => i.id === this.projectSelect),
            projectId: this.projectSelect,
            status: this.statusTaskSelect,
            members: this.employees.filter((i) => i.id === this.employeeSelect),
            estimateDays: '',
            estimateHours: '',
            estimateMinutes: '',
            dueDate: this.dueDate,
            description: this.description,
            tags: this.selectedTags.map((i) => {
                const tag = this.tags.find((y) => y.id === i);
                return tag;
            }),
            teams: null,
            estimate: null,
            organizationId: this.userData.organizationId,
            tenantId: this.userData.tenantId
        }


        try {
            await this.timeTrackerService.saveNewTask(this.userData, payloadTask);
            this.isAddTask.emit(false);
            this.newTaskCallback.emit({
                isSuccess: true
            });
            this._cdr.detectChanges();
        } catch (error) {
            this.newTaskCallback.emit({
                isSuccess: false,
                message: error.message
            })
        }
    }
}
