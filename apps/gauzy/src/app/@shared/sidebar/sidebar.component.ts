import { IHelpCenter } from '@gauzy/models';
import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { TreeComponent, ITreeOptions } from 'angular-tree-component';
import { FormGroup, FormBuilder } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { isEqual } from './delete-node';
import { Subject } from 'rxjs';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { AddIconComponent } from './add-icon/add-icon.component';
import { first } from 'rxjs/operators';
import { HelpCenterService } from '../../@core/services/help-center.service';

@Component({
	selector: 'ga-sidebar',
	templateUrl: './sidebar.component.html',
	styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private dialogService: NbDialogService,
		private readonly fb: FormBuilder,
		private sanitizer: DomSanitizer,
		private helpService: HelpCenterService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}
	form: FormGroup;
	public articleName = 'Chose any article';
	public articleDesc = '';
	public articleData: SafeHtml;
	public languages = ['en', 'ru', 'he', 'bg'];
	public colors = ['black', 'blue'];
	public selectedLang = '';
	public selectedColor = '';
	public showArticleButton = false;
	public showCategoryButton = false;
	public nodeId = 0;
	public chosenCategory = false;
	public chosenArticle = false;
	public isVisibleAdd = false;
	public isVisibleEdit = false;
	public isChosenNode = false;
	public nodes: IHelpCenter[] = [];
	options: ITreeOptions = {
		allowDrag: true,
		allowDrop: (el, { parent, index }) => {
			if (parent.data.flag === 'article') {
				return false;
			} else {
				return true;
			}
		}
	};
	@ViewChild(TreeComponent)
	private tree: TreeComponent;

	async onMoveNode($event) {
		const movedNode = $event.node;
		await this.helpService.update(movedNode.id, {
			parent: $event.to.parent,
			index: $event.to.index
		});
	}

	addNode() {
		this.isVisibleAdd = true;
	}
	showInput(key: number) {
		if (key === 1) {
			this.showArticleButton = true;
		} else {
			this.showCategoryButton = true;
		}
	}

	async addName(event: any, key: number) {
		if (key !== 1) {
			await this.helpService.create({
				name: `${event.target.value}`,
				icon: 'book-open-outline',
				flag: 'category',
				privacy: 'eye-outline',
				language: 'en',
				color: 'black',
				index: 0,
				children: []
			});
		} else {
			await this.helpService.create({
				name: `${event.target.value}`,
				icon: 'book-open-outline',
				flag: 'article',
				privacy: 'eye-outline',
				description: '',
				language: 'en',
				color: 'black',
				index: 0,
				data: ''
			});
		}
		this.loadMenu();
		this.tree.treeModel.update();
		this.isVisibleAdd = false;
		this.showArticleButton = false;
		this.showCategoryButton = false;
	}
	onNodeClicked(node: any) {
		this.nodeId = node.data.id;
		this.isChosenNode = true;
		this.articleName = node.data.name;
		this.selectedLang = node.data.language;
		this.selectedColor = node.data.color;
		if (node.data.flag === 'article') {
			this.articleDesc = node.data.description;
			this.articleData = this.sanitizer.bypassSecurityTrustHtml(
				node.data.data.toString()
			);
			this.chosenCategory = false;
			this.chosenArticle = true;
			this.loadFormData(node.data);
		} else {
			this.chosenCategory = true;
			this.chosenArticle = false;
		}
	}
	onCloseAdding() {
		this.isVisibleAdd = false;
	}
	onCloseInput() {
		this.showArticleButton = false;
		this.showCategoryButton = false;
	}

	async addIcon(node) {
		this.onNodeClicked(node);
		const dialog = this.dialogService.open(AddIconComponent);
		const chosenIcon = await dialog.onClose.pipe(first()).toPromise();
		if (chosenIcon) {
			const someNode = this.tree.treeModel.getNodeById(this.nodeId);
			someNode.data.icon = chosenIcon;
			await this.helpService.update(someNode.data.id, {
				icon: `${someNode.data.icon}`
			});
		}

		this.tree.treeModel.update();
	}

	async changePrivacy(node: any) {
		this.onNodeClicked(node);
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		someNode.data.privacy =
			someNode.data.privacy === 'eye-outline'
				? 'eye-off-outline'
				: 'eye-outline';
		await this.helpService.update(someNode.data.id, {
			privacy: `${someNode.data.privacy}`
		});
		this.tree.treeModel.update();
	}

	async editNameCategory(event: any) {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		someNode.data.name = event.target.value;
		this.isVisibleEdit = false;
		await this.helpService.update(someNode.data.id, {
			name: `${someNode.data.name}`,
			language: this.selectedLang,
			color: this.selectedColor
		});
		this.loadMenu();
	}
	onCloseEditing() {
		this.isVisibleEdit = false;
	}

	onEditArticle() {
		this.isVisibleEdit = true;
	}

	async onDeleteArticle() {
		isEqual(this.nodes, this.nodeId);
		await this.helpService.delete(`${this.nodeId}`);
		this.tree.treeModel.update();
		this.isChosenNode = false;
		this.articleName = 'Chose any article';
	}

	loadFormData(data) {
		this.form.patchValue({
			name: data.name,
			desc: data.description,
			data: data.data.toString()
		});
	}

	editData(value: string) {
		this.articleData = this.sanitizer.bypassSecurityTrustHtml(value);
	}

	async submit() {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		someNode.data.description = this.form.controls.desc.value;
		someNode.data.name = this.form.controls.name.value;
		this.articleDesc = someNode.data.description;
		this.articleName = someNode.data.name;
		await this.helpService.update(someNode.data.id, {
			name: `${someNode.data.name}`,
			description: `${someNode.data.description}`,
			data: this.articleData.toString(),
			language: this.selectedLang,
			color: this.selectedColor
		});
		this.loadMenu();
		this.isVisibleEdit = false;
	}

	async loadMenu() {
		const result = await this.helpService.getAll(['parent', 'children']);
		let tempNodes: IHelpCenter[] = [];
		if (result) {
			tempNodes = result.items;
			this.nodes = tempNodes.filter((item) => item.parent === null);
		}
	}
	ngOnInit() {
		this.loadMenu();
		this.form = this.fb.group({
			name: [''],
			desc: [''],
			data: ['']
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
