/**
 * The part of `mailparser` (3.x, which ships no types) the inbound pipeline uses: `simpleParser`.
 */
declare module 'mailparser' {
	export interface MailparserAddress {
		address?: string;
		name?: string;
		group?: MailparserAddress[];
	}

	export interface MailparserAddressObject {
		value: MailparserAddress[];
		text?: string;
	}

	export interface MailparserAttachment {
		type: 'attachment';
		content: Buffer;
		contentType?: string;
		contentDisposition?: string;
		filename?: string;
		/** With angle brackets. */
		contentId?: string;
		/** Without angle brackets. */
		cid?: string;
		related?: boolean;
		size?: number;
		checksum?: string;
	}

	export interface ParsedMail {
		headers: Map<string, unknown>;
		headerLines?: Array<{ key: string; line: string }>;
		subject?: string;
		from?: MailparserAddressObject;
		to?: MailparserAddressObject | MailparserAddressObject[];
		cc?: MailparserAddressObject | MailparserAddressObject[];
		bcc?: MailparserAddressObject | MailparserAddressObject[];
		replyTo?: MailparserAddressObject;
		messageId?: string;
		inReplyTo?: string;
		references?: string | string[];
		date?: Date;
		text?: string;
		html?: string | false;
		attachments: MailparserAttachment[];
	}

	export interface SimpleParserOptions {
		/** Keep `cid:` links in the HTML instead of inlining the parts as `data:` URLs. */
		keepCidLinks?: boolean;
		/** Skip turning the HTML into text (the pipeline derives text itself). */
		skipHtmlToText?: boolean;
		skipTextToHtml?: boolean;
		skipTextLinks?: boolean;
		skipImageLinks?: boolean;
		maxHtmlLengthToParse?: number;
	}

	export function simpleParser(input: Buffer | string, options?: SimpleParserOptions): Promise<ParsedMail>;
}
