/**
 * Compares record-type spellings the way the databases' text collations may: ignoring case, accents, spaces,
 * punctuation and ignorable characters. MySQL's default collations find `organizationcontact` equal to
 * `OrganizationContact`, so a comment stored under such a spelling is read with that record's comments there.
 */
const RECORD_TYPE_SPELLING = new Intl.Collator('en', { sensitivity: 'base', ignorePunctuation: true, usage: 'search' });

/**
 * Whether two record-type spellings name the same record type, by {@link RECORD_TYPE_SPELLING}.
 *
 * @param spelling - A stored or stated record type.
 * @param type - The record type as its comment-access policy names it.
 */
export function isSpellingOfRecordType(spelling: string, type: string): boolean {
	return RECORD_TYPE_SPELLING.compare(spelling, type) === 0;
}
