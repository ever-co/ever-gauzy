<!--
  This is documentation, not SDL, and the extension is what says so.

  The domain contributes no root field and no type: an export streams a file through the HTTP response and
  an import is a multipart upload whose answer is the import ledger row another domain declares. A document
  that declares nothing cannot be a GraphQL document at all — the parser refuses a file with no definition
  ("Unexpected <EOF>"), and the boot composes every `*.gql` under a `schema/` directory — so the explanation
  lives beside where the SDL would have been, in a file the composition does not read.
-->
# The import domain declares no object type, and this document is the record of that decision.
#
# The domain owns no entity. What a row of an imported archive becomes is a row of the table the CSV
# names, and those tables belong to the domains that own them — this domain writes them through the
# platform's repository registry rather than describing them.
#
# The one thing the delivered route answers is a ledger row, and that row has an owner: `ImportHistory`
# is declared by `export-import/import-history/schema/import-history.type.gql`, where the connection that
# reads the ledger is declared beside it. Declaring it again here would be a second declaration of one
# concept, which the composition pass refuses and which would diverge the moment either copy was edited.
#
# The delivered route itself is described in `import.api.md` beside this file, together with the reason
# an uploaded archive is not an argument this schema can declare.
