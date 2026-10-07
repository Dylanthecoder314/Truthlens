# Chat log: MH370 documentary

Session date: 7 October 2026. This is a written record of the conversation, kept with the work as requested. It is not an automatic export of the chat.

---

**User:** can you create an documentary on the missing malaysian flight mh 370?

**Claude:** Chose to build it as an interactive web documentary: chapters, a timeline, a flight-path map and a fact check of the theories. Used verified facts and drawn maps rather than AI-generated footage of a real tragedy.

Research (web searches, 7 Oct 2026):
- Latest search status: Ocean Infinity's 2025–26 search (about 7,571 km², 28 search days) found nothing. Malaysia announced this on 8 March 2026. In June 2026 the contract was extended to 30 June 2027 for the remaining 7,428.54 km², still no find, no fee (US$70 million on success).
- Core timeline: takeoff 00:42, "Good night. Malaysian three seven zero" at 01:19:30, transponder lost 01:21:13 near IGARI, last military radar 02:22, final partial handshake 08:19:29 MYT.
- Passengers and nationalities (final manifest, totals 239), the ATSB underwater search (120,000 km², about A$200 million, suspended 17 Jan 2017), Ocean Infinity 2018 (112,000 km²), debris finds and their confirmation status, the 2018 Safety Investigation Report findings, the December 2025 Beijing court ruling, and the WSPR and hydroacoustic theories.

---

**User:** sorry just interrupting to tell u that please put this chat and the work in the "documentary" folder in the claude projects folder

**Claude:** Looked for an existing "documentary" or "Claude Projects" folder on the cloud machine and in Google Drive and found neither. Created `documentary/` in the project workspace (the TruthLens repository) and kept all the work there: the page, research notes, map tooling and this log. Committed and pushed it to branch `claude/jolly-meitner-7o6d6j` so it survives the end of the session.

Moving the chat itself into a claude.ai Project is done from the Claude app; there is no tool for it in this session.

---

## What was built

- `index.html`: the documentary, nine chapters plus a prologue, with two interactive maps (the last radar track and the 7th arc), a one-dot-per-person view of everyone on board, a debris table, a fact check of seven claims, a search ledger and a status box.
- Published as a private artifact: https://claude.ai/artifact/DttCnhCaXVWPPrdN9z3ABu
- `RESEARCH.md`: fact sheet, sources and a list of approximations.
- `tools/build-maps.mjs`: map geometry builder (Natural Earth coastlines via `world-atlas`, projected with `d3-geo`).
