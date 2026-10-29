# Record controls and their scope

Run /compliance for findings and /retention for records whose review date has passed. These are operating checks, not a legal certification. No fixed legal retention interval is invented. The business supplies each review date and decides whether a record is still required. No records are deleted automatically.

| Check | Source and implementation |
|---|---|
| PURPOSE | [NZ Privacy Principle 1](https://www.privacy.org.nz/privacy-principles/1/) concerns a lawful, necessary collection purpose. The CLI requires a purpose, and imported or older blank values appear in findings. Text alone does not establish lawful collection. |
| RETENTION-REVIEW | [NZ Privacy Principle 9](https://www.privacy.org.nz/privacy-principles/9/) limits retention beyond the purpose. A past review date prompts a decision, not automatic deletion. |
| Restricted records | [NZ Privacy Principle 5](https://www.privacy.org.nz/privacy-principles/5/) and [Australian APP 11](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/handling-personal-information/guide-to-securing-personal-information) address security and appropriate handling. Domain tables deny public access and private outputs use restricted file permissions where supported. |
| HANDOFF-DUE | Our local operating policy compares supplied deadlines to the current clock. No statutory response time is claimed. |
| UNAVAILABLE-OWNER | Our roster check identifies open enquiries owned by someone marked unavailable. It does not change their owner automatically. |

Sources checked 29 October 2026. APP coverage and retention exceptions depend on the organisation and records. Human review must establish the applicable obligations. Encryption, authenticated access, backup recovery and a retention process remain deployment responsibilities.

The embedded database is for a trusted local operator. RLS has no public policies; the CLI uses a trusted database owner. Actor names are supplied, not verified identities, and owners can edit history. Do not expose the owner connection to other users or treat logs as immutable evidence. Never place live leads, exports or credentials in version control.
