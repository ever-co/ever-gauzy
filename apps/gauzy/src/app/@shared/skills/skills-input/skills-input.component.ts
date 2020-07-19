import {
	Component,
	OnInit,
	ViewChild,
	Input,
	Output,
	EventEmitter
} from '@angular/core';
import { SkillsService } from '../../../@core/services/skills.service';
import { NgModel, FormGroup } from '@angular/forms';

@Component({
	selector: 'ngx-skills-input',
	templateUrl: './skills-input.component.html',
	styleUrls: ['./skills-input.component.scss']
})
export class SkillsInputComponent implements OnInit {
	@ViewChild('shownInput', { static: true })
	shownInput: NgModel;

	@Input('skills')
	skills: any;

	@Input('form')
	form: FormGroup;

	@Input('selectedSkills')
	selectedSkills: any;

	@Input('items')
	items: any;

	@Output()
	selectedSkillsEvent: EventEmitter<any> = new EventEmitter<any>();

	constructor(private readonly skillsService: SkillsService) {}

	async onChange() {
		const skills = [];

		for (const skill of this.selectedSkills) {
			const skillToCheck = await this.skillsService.findByName(
				skill.name
			);
			if (!skillToCheck) {
				const skillNew = await this.skillsService.insertSkill({
					name: skill.name,
					description: '',
					color: ''
				});
				console.log(skillNew);
				if (skillNew.id) {
					skills.push(skillNew);
				}
			} else {
				skills.push(skillToCheck);
			}
		}

		this.selectedSkillsEvent.emit(skills);
	}

	ngOnInit() {
		this.getAllSkills();
	}

	selectedSkillsHandler(ev) {
		this.form.get('selectedSkills').setValue(ev);
	}

	async getAllSkills() {
		const { items } = await this.skillsService.getAllSkills();
		this.skills = items;
	}
}
