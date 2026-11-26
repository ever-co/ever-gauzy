import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	HostListener,
	OnDestroy,
	OnInit,
	ViewChild
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, filter, tap } from 'rxjs/operators';
import {
	BaseEntityEnum,
	IEmployee,
	IOrganization,
	IProposal,
	IProposalFindInput,
	IUser,
	ProposalStatusEnum
} from '@gauzy/contracts';
import { ProposalsService, Store } from '@gauzy/ui-core/core';
import { RecordViewPageState } from '@gauzy/ui-core/shared';

/** Proposals read per request while looking for a proposal's neighbours: the endpoint's maximum. */
const NEIGHBOUR_PAGE_SIZE = 100;

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-proposal-details',
    templateUrl: './proposal-details.component.html',
    styleUrls: ['./proposal-details.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ProposalDetailsComponent implements AfterViewInit, OnInit, OnDestroy {
	/** The favorite toggle binds the enum member: the library compiles its templates strictly. */
	protected readonly BaseEntityEnum = BaseEntityEnum;
	public user: IUser;
	public employee: IEmployee;
	public proposal: IProposal;
	public jobPostLink: SafeHtml;
	public jobPostContent: SafeHtml;
	public proposalContent: SafeHtml;
	/** The page's back button leads to the proposals list (the routes file imports this component, so not its constant). */
	public readonly backLink = '/pages/sales/proposals';
	public state: RecordViewPageState = 'loading';
	/**
	 * The proposal's own organization, loaded with it: the sheet's sender. Never the organization
	 * selected in the header, which can be another one (a bookmarked proposal, or a switch while the
	 * page is open).
	 */
	public organization: IOrganization | null = null;
	/** The proposal text has headings, so the sheet numbers its sections and indents their text. */
	public hasSections = false;

	/** The proposals either side of this one, in the list's order (newest sent first). */
	public previousProposal: IProposal | null = null;
	public nextProposal: IProposal | null = null;
	/** Bumped by every neighbour read; a read that is no longer the latest when it answers is dropped. */
	private neighboursSequence = 0;

	/** The printable proposal sheet. */
	@ViewChild('sheet') private readonly sheetRef?: ElementRef<HTMLElement>;

	/**
	 * The sheet's reference code, e.g. `PRP-20261126-106D`: the day it was sent (else entered),
	 * then the start of its id so two proposals of one day still differ.
	 */
	protected get documentCode(): string {
		if (!this.proposal?.id) {
			return '';
		}
		const date = new Date(this.proposal.valueDate || this.proposal.createdAt || Date.now());
		const day = Number.isNaN(date.getTime())
			? ''
			: `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-`;
		return `PRP-${day}${this.proposal.id.slice(0, 4).toUpperCase()}`;
	}

	/**
	 * The author's name as signed on the sheet: first and last name in full when both are known,
	 * since the stored display name can be shortened (e.g. "Jane D.").
	 */
	protected get authorName(): string {
		const user = this.proposal?.author?.user;
		const fullName = [user?.firstName, user?.lastName].filter((part) => !!part?.trim()).join(' ');
		return fullName || this.proposal?.author?.fullName || user?.name || '';
	}

	/** The sender's website for the sheet's footer. */
	protected get organizationWebsite(): string {
		return this.organization?.website || '';
	}

	protected get isAccepted(): boolean {
		return this.proposal?.status === ProposalStatusEnum.ACCEPTED;
	}

	constructor(
		private readonly route: ActivatedRoute,
		private readonly store: Store,
		private readonly sanitizer: DomSanitizer,
		private readonly router: Router,
		private readonly proposalsService: ProposalsService
	) {}

	ngOnInit(): void {
		this.store.user$
			.pipe(
				filter((user: IUser) => !!user),
				tap((user: IUser) => (this.user = user)),
				tap((user: IUser) => (this.employee = user?.employee)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this.route.data
			.pipe(
				debounceTime(100),
				filter((data) => !!data && !!data.proposal),
				tap(({ proposal }) => {
					try {
						this.proposal = Object.assign({}, proposal, {
							jobPostLink: proposal.jobPostUrl ? proposal.jobPostUrl : '',
							jobTitle: proposal.jobPostContent
								.toString()
								.replace(/<[^>]*(>|$)|&nbsp;/g, '')
								.split(/[\s,\n]+/)
								.slice(0, 3)
								.join(' '),
							author: proposal.employee
						});
						this.setProposal();
					} catch (error) {
						this.router.navigate(['/pages/sales/proposals']);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Sets the proposal data.
	 */
	setProposal() {
		this.organization = this.proposal.organization ?? null;
		this.jobPostLink = this.proposal.jobPostUrl;
		this.jobPostContent = this.sanitizer.bypassSecurityTrustHtml(
			this.withSectionHeadings(this.proposal.jobPostContent)
		);
		const proposalHtml = this.withSectionHeadings(this.proposal.proposalContent);
		this.hasSections = /<h[1-6][\s>]/i.test(proposalHtml);
		this.proposalContent = this.sanitizer.bypassSecurityTrustHtml(proposalHtml);
		this.state = 'ready';
		void this.loadNeighbours(this.proposal);
	}

	/**
	 * Finds the proposals around this one in the order the proposals list shows them: newest sent
	 * first, then newest entered, then by id so equal dates keep a fixed order. The server applies
	 * that order and the list's scope (the proposal's organization and, when one is selected in the
	 * header, that employee); the pages are read in turn, ids and dates only, until this proposal is
	 * found. Its neighbours are then the rows either side of it — the last row of the page before,
	 * or the first of the page after, when it sits at a page edge. While it reads, or if a read
	 * fails, the buttons stay disabled.
	 */
	private async loadNeighbours(proposal: IProposal): Promise<void> {
		const sequence = ++this.neighboursSequence;
		this.previousProposal = null;
		this.nextProposal = null;
		const { organizationId, tenantId } = proposal;
		if (!proposal.id || !organizationId || !tenantId) {
			return;
		}
		const employeeId = this.store.selectedEmployee?.id;
		const where = { organizationId, tenantId, ...(employeeId ? { employeeId } : {}) } as IProposalFindInput;
		const readPage = (page: number) =>
			this.proposalsService.getPage(where, {
				order: { valueDate: 'DESC', createdAt: 'DESC', id: 'ASC' },
				select: { id: true, valueDate: true, createdAt: true },
				take: NEIGHBOUR_PAGE_SIZE,
				skip: page
			});
		const stale = () => sequence !== this.neighboursSequence;
		try {
			let lastOfPreviousPage: IProposal | null = null;
			for (let page = 1; ; page++) {
				const { items = [], total = 0 } = await readPage(page);
				if (stale()) {
					return;
				}
				const index = items.findIndex((item) => item.id === proposal.id);
				if (index >= 0) {
					const previous = index > 0 ? items[index - 1] : lastOfPreviousPage;
					let next: IProposal | null = items[index + 1] ?? null;
					if (!next && page * NEIGHBOUR_PAGE_SIZE < total) {
						const following = await readPage(page + 1);
						if (stale()) {
							return;
						}
						next = following.items?.[0] ?? null;
					}
					this.previousProposal = previous;
					this.nextProposal = next;
					return;
				}
				if (!items.length || page * NEIGHBOUR_PAGE_SIZE >= total) {
					return;
				}
				lastOfPreviousPage = items[items.length - 1];
			}
		} catch {
			// The buttons stay disabled: the page itself is unaffected.
		}
	}

	/** Opens another proposal's page: the previous or the next one. */
	openProposal(proposal: IProposal | null): void {
		if (proposal?.id) {
			void this.router.navigate(['/pages/sales/proposals/details', proposal.id]);
		}
	}

	/**
	 * K and J step to the previous and next proposal, as on the payment page; not while the viewer
	 * types, holds a modifier, or has a dialog or menu open.
	 */
	@HostListener('document:keydown', ['$event'])
	onKeydown(event: KeyboardEvent): void {
		if (!this.proposal || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
			return;
		}
		const target = event.target as HTMLElement | null;
		if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
			return;
		}
		if (document.querySelector('.cdk-overlay-backdrop')) {
			return;
		}
		switch ((event.key || '').toLowerCase()) {
			case 'k':
				if (this.previousProposal) {
					event.preventDefault();
					this.openProposal(this.previousProposal);
				}
				break;
			case 'j':
				if (this.nextProposal) {
					event.preventDefault();
					this.openProposal(this.nextProposal);
				}
				break;
		}
	}

	/**
	 * Proposals are usually written with bold lines for section names ("What I would bring")
	 * rather than the editor's headings. A top-level paragraph that is just a bold line — or a
	 * bold line and then a line break — becomes a heading: the sheet numbers it as a section, and
	 * the job post shows it as a subheading.
	 * Parsed with DOMParser, which runs no scripts and loads nothing.
	 */
	private withSectionHeadings(html: string | null | undefined): string {
		if (!html) {
			return '';
		}
		const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
		const isBlank = (node: ChildNode | null) => node?.nodeType === Node.TEXT_NODE && !node.textContent?.trim();
		for (const paragraph of Array.from(doc.body.querySelectorAll(':scope > p'))) {
			const bold = paragraph.firstElementChild;
			if (!bold || !['STRONG', 'B'].includes(bold.tagName)) {
				continue;
			}
			// The bold run must open the paragraph.
			const lead = Array.from(paragraph.childNodes).find((node) => !isBlank(node));
			const title = (bold.textContent || '').trim().replace(/:$/, '');
			if (lead !== bold || !title || title.length > 80) {
				continue;
			}
			let next = bold.nextSibling;
			while (next && isBlank(next)) {
				next = next.nextSibling;
			}
			if (next && next.nodeName !== 'BR') {
				continue;
			}
			// The heading takes the bold run's own nodes — a link or a line break inside it stays —
			// less a trailing colon.
			const heading = doc.createElement('h3');
			heading.append(...Array.from(bold.childNodes));
			const last = heading.lastChild;
			if (last?.nodeType === Node.TEXT_NODE) {
				last.textContent = (last.textContent || '').replace(/:\s*$/, '');
			}
			if (!next) {
				paragraph.replaceWith(heading);
			} else {
				// "Availability<br>I can start…": the heading, then the rest as its paragraph.
				next.remove();
				bold.remove();
				paragraph.before(heading);
			}
		}
		return doc.body.innerHTML;
	}

	/**
	 * Prints the proposal sheet alone — or saves it as PDF from the print dialog. The sheet is
	 * copied, with the app's styles, into a hidden frame, so the page's menus and sidebar stay
	 * out of the print and the text flows over as many A4 pages as it needs. The copy is set
	 * in the light theme's colours, whatever theme the app is in.
	 */
	print(): void {
		const sheet = this.sheetRef?.nativeElement;
		if (!sheet) {
			return;
		}
		const frame = document.createElement('iframe');
		frame.setAttribute('aria-hidden', 'true');
		frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
		document.body.appendChild(frame);
		const frameDoc = frame.contentDocument;
		const frameWindow = frame.contentWindow;
		if (!frameDoc || !frameWindow) {
			frame.remove();
			return;
		}
		frameDoc.open();
		frameDoc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
		frameDoc.close();
		// The title is the PDF's suggested file name.
		frameDoc.title = this.documentCode || 'proposal';
		// The page's language and direction, so right-to-left translations print the right way round.
		frameDoc.documentElement.lang = document.documentElement.lang;
		frameDoc.documentElement.dir = document.documentElement.dir || getComputedStyle(sheet).direction;

		// The app's stylesheets carry the sheet's own (component) styles. The body is left without
		// the app's theme classes, so no page chrome or theme frame comes along.
		const pending: Promise<unknown>[] = [];
		document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
			const copy = frameDoc.importNode(node, true) as HTMLElement;
			// `copy` belongs to the iframe's document, so it is never an instance of this window's
			// HTMLLinkElement: the original's tag says whether it is a stylesheet link to wait for.
			if (node.tagName === 'LINK') {
				pending.push(
					new Promise((done) => {
						copy.addEventListener('load', done);
						copy.addEventListener('error', done);
					})
				);
			}
			frameDoc.head.appendChild(copy);
		});

		/*
		 * The page has no margin of its own (`@page { margin: 0 }`), which keeps the browser from
		 * printing its date / title / URL header and footer. The margins are drawn instead: the
		 * body's side padding on every page, and a table whose header and footer rows — repeated
		 * by the browser on every printed page — give each page its top and bottom space, the
		 * footer carrying the reference.
		 */
		const reference = this.documentCode.replace(/[^A-Z0-9-]/g, '');
		const fontFamily = getComputedStyle(sheet).fontFamily;
		const printStyles = frameDoc.createElement('style');
		printStyles.textContent = `
			@page { size: A4; margin: 0; }
			html, body {
				margin: 0 !important;
				padding: 0 !important;
				height: auto !important;
				overflow: visible !important;
				border: 0 !important;
				outline: 0 !important;
				box-shadow: none !important;
				background: #fff !important;
			}
			body { padding: 0 16mm !important; font-family: ${fontFamily}; color: #111827; }
			* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

			table.pd-print { width: 100%; border: 0; border-collapse: collapse; }
			table.pd-print > * > tr > td { padding: 0; border: 0; vertical-align: top; }
			.pd-print-top { height: 16mm; }
			.pd-print-bottom { height: 16mm; vertical-align: bottom !important; }
			.pd-print-reference {
				display: block;
				padding: 4mm 0 7mm;
				font: 500 7.5pt/1 ui-monospace, 'Cascadia Code', Consolas, monospace;
				letter-spacing: 0.04em;
				text-align: end;
				color: #9ca3af;
			}

			html body .pd-print .pd-sheet {
				--text-basic-color: #111827;
				--text-hint-color: #6b7280;
				--gauzy-card-1: #fff;
				--background-basic-color-1: #fff;
				--gauzy-overlay-border-color: #e5e7eb;
				max-width: none !important;
				min-height: 0 !important;
				margin: 0 !important;
				padding: 0 !important;
				border: 0 !important;
				border-radius: 0 !important;
				box-shadow: none !important;
				background: #fff !important;
			}

			/* Lists exactly as on screen: dashes hung 1rem before the text, nothing else. */
			html body .pd-print .pd-sheet-text ul { padding: 0 !important; list-style: none !important; }
			html body .pd-print .pd-sheet-text ul > li { margin: 0 !important; padding-block: 0 !important; padding-inline: 1rem 0 !important; }
			html body .pd-print .pd-sheet-text li + li { margin-top: 0.25rem !important; }

			/* Clean breaks: a heading never ends a page; items, rows and the sign-off never split. */
			h1, h2, h3, h4, h5, h6 { break-after: avoid; page-break-after: avoid; }
			li, tr, img, pre, blockquote, .pd-sheet-facts, .pd-sheet-footer { break-inside: avoid; page-break-inside: avoid; }
			p { orphans: 3; widows: 3; }
		`;
		frameDoc.head.appendChild(printStyles);

		const table = frameDoc.createElement('table');
		table.className = 'pd-print';
		table.innerHTML =
			'<thead><tr><td class="pd-print-top"></td></tr></thead>' +
			'<tbody><tr><td class="pd-print-content"></td></tr></tbody>' +
			'<tfoot><tr><td class="pd-print-bottom"><span class="pd-print-reference"></span></td></tr></tfoot>';
		(table.querySelector('.pd-print-reference') as HTMLElement).textContent = reference;
		const copy = frameDoc.importNode(sheet, true) as HTMLElement;
		(table.querySelector('.pd-print-content') as HTMLElement).appendChild(copy);
		frameDoc.body.appendChild(table);
		copy.querySelectorAll('img').forEach((image) => {
			if (!image.complete) {
				pending.push(new Promise((done) => (image.onload = image.onerror = done)));
			}
		});

		// Print once the styles and images are in — or after two seconds, whichever comes first.
		const ready = Promise.race([Promise.all(pending), new Promise((done) => setTimeout(done, 2000))]);
		ready.then(() => {
			frameWindow.focus();
			frameWindow.print();
			setTimeout(() => frame.remove(), 1000);
		});
	}

	/**
	 * Navigates to the edit page of the proposal.
	 */
	edit() {
		if (this.proposal) {
			this.router.navigate([`/pages/sales/proposals/edit`, this.proposal.id]);
		}
	}

	ngOnDestroy(): void {}
}
