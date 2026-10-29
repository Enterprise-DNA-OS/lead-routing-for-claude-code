# Bring your Chili Piper routing record across

## Export

In the workspace Rules area, open Assignment Tables and use CSV Options, Download CSV. The [vendor guide](https://help.chilipiper.com/hc/en-us/articles/55552984179475-How-do-I-use-Assignment-Tables) documents this format. Keep the original privately. The CSV stores values and destinations; it does not carry the separate comparison conditions. Record those conditions before leaving Chili Piper. Checked 29 October 2026.

## Prepare and import

Start with an empty database: npm install, npm run migrate. Create the representatives, distributions and memberships through add-rep, add-team and join-team. The importer resolves exact user emails and distribution names or IDs against your own register. No people are created from guesses.

Create a mapping like fixtures/chili-piper-map.json. Each condition names the source column, local enquiry attribute, type, comparison and whether an empty source cell is a wildcard. The fixtures are synthetic examples, not customer exports.

```bash
npm run routing -- import chili-piper --file=imports/territories.csv --map=imports/territories-map.json --name="Territories October" --actor="Mere" --dry-run
```

Compare the row count and digest, then repeat without --dry-run. Import creates an inactive version, preserves row order and retains source values. Reimporting the same values and mapping is a no-op. Any invalid row rolls back the entire operation.

## Check before using

Use rules to inspect the imported conditions. Add representative sample enquiries with add. Run preview --ref=<enquiry> --ruleset="Territories October" for each boundary, then coverage with the same version. Include missing fields, no-match countries, unavailable owners and full distributions. Record real review evidence with activate only after those checks agree with the intended policy.

## Mapping and limits

| Native export | Local record |
|---|---|
| row_name | Rule label, or row position if absent |
| Attribute columns | Explicit mapped AND conditions |
| Assignment type and value | Exact user email or existing distribution |
| CSV row order | First-match priority |
| Full original cell values | Private source snapshot |

One record-assignment destination per row is supported. All columns must be accounted for. Multiple meeting destinations, OR groups, full router graphs and proprietary distribution settings need further implementation. Missing numeric inputs are held out of numeric comparisons rather than treated as zero. Enquiry history is a separate migration, not included in this export.

## Operating switch

The free base routes records held locally. It does not update Salesforce, poll forms, synchronise calendars, send alerts or book meetings. Enterprise DNA scopes these connections and the operating checks into a managed version. Keep the existing service until the actual end-to-end intake, assignment and calendar requirements have passed acceptance. A routing CSV import alone is not a complete Chili Piper replacement.
