export const meta = {
  name: 'qa-mh370-edit',
  description: 'Adversarial QA of the edited MH370 film: sync, on-screen facts, visuals and audio',
  phases: [
    { title: 'Inspect', detail: 'four reviewers, each with one lens, examine the finished file' },
    { title: 'Challenge', detail: 'a skeptic re-checks every reported defect before it is fixed' },
  ],
}

const FINDINGS = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: {
      time: { type: 'string', description: 'timestamp(s) in the EDITED film, e.g. 02:14.5' },
      scene_time: { type: 'string', description: 'if in the rebuilt section: scene id and seconds into it, e.g. rA 64.0' },
      severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
      problem: { type: 'string' },
      evidence: { type: 'string', description: 'what you looked at (frame file, measurement, transcript line)' },
      fix: { type: 'string', description: 'concrete change, ideally naming the file and code' },
    }, required: ['time', 'severity', 'problem', 'evidence', 'fix'] } },
    checked: { type: 'array', items: { type: 'string' } },
  },
  required: ['findings', 'checked'],
}
const VERDICTS = {
  type: 'object',
  properties: { verdicts: { type: 'array', items: { type: 'object', properties: {
    time: { type: 'string' }, problem: { type: 'string' }, real: { type: 'boolean' }, reasoning: { type: 'string' }, fix: { type: 'string' },
  }, required: ['time', 'problem', 'real', 'reasoning', 'fix'] } } },
  required: ['verdicts'],
}

const CONTEXT = `You are reviewing an edit of a user's MH370 documentary video. Be adversarial: look hard for real defects, but report only things a viewer would notice or that are factually wrong.

Files (read-only; do not modify anything under documentary/):
- Edited film: ${args.film}
- Original upload (for reference): ${args.source}. In the original, the picture went blank white from 67.03 s to the end while the narration continued.
- The edit keeps the original intro (0 to 67.033 s), removes the silent gap 67.033-71.7 s of the original, and replaces the white picture with rebuilt animated scenes rA (174.7 s) then rB (55.8 s). A time T in the original narration therefore plays at T - 4.667 s in the edit. rA starts at 67.033 s in the edit, rB at 241.733 s.
- Scene sources: /home/user/Truthlens/documentary/video/remaster/scenes/rA.html and rB.html (and the shared /home/user/Truthlens/documentary/video/scenes/lib.js). Cue times (original-upload seconds) are in /home/user/Truthlens/documentary/video/remaster/cues.json.
- An automatic transcript with word timestamps (original-upload seconds; the recogniser makes many errors, so read it phonetically) is at ${args.words}. Here is a cleaned reading of the narration: ${args.transcript}

Tools: use ffmpeg/ffprobe in Bash to extract frames (e.g. ffmpeg -ss 125 -i FILM -frames:v 1 OUT.png) or tiled contact sheets (fps=1,scale=480:-1,tile=6x5), and view them with the Read tool. Write scratch files only under ${args.scratch}/<your-lens>/ (create it). Do not render scenes or edit files.`

const LENSES = [
  { key: 'sync', prompt: `${CONTEXT}

YOUR LENS: sync between narration and picture, 67 s to the end. For each narration beat (takeoff, the aircraft type, 239 on board, cabin and South China Sea, 35,000 ft, 01:07 ACARS, twelve minutes later at IGARI, the radio exchange, "very last communication", 01:21 transponder, "vanishes into thin air", military primary radar, the left bank and turn back, Sumatra and the southern Indian Ocean, then each question, 239 souls, satellite pings, the final line), extract frames at the moment the words are spoken (edit time = original time - 4.667) and 1.5 s later. Check that the picture shows what is being said, roughly when it is said: not seconds early, not late, and not left over from an earlier beat. Report mismatches with exact times.` },
  { key: 'facts', prompt: `${CONTEXT}

YOUR LENS: on-screen facts. Read every piece of on-screen text in rA.html and rB.html, and check frames to see it as rendered. Verify each fact against reliable knowledge of MH370, and search the web if unsure: times (MYT), the radio exchange wording and frequency, ACARS timing and "next report due 01:37", 9M-MRO, Boeing 777-200ER, the nationality counts (China 153, Malaysia 50 incl. 12 crew, Indonesia 7, Australia 6, India 5, France 4, US 3, Canada 2, Iran 2, NZ 2, Ukraine 2, Netherlands 1, Russia 1, Taiwan 1), Penang/Pulau Perak/last radar 02:22:12, "63 minutes", "seven satellite handshakes", "No emergency beacon signal detected", "The 2018 safety investigation found the turns were most likely flown by hand", "None has been proven", "never found" as of October 2026. Flag anything wrong, misleading or presented as fact when it is inference (the path after 02:22 should read as inferred). Also note narration claims in the user's own audio that are wrong or speculative (we cannot change the audio, but the user should know).` },
  { key: 'visual', prompt: `${CONTEXT}

YOUR LENS: visual quality and transitions. Make contact sheets of the whole edit at 1 frame per 2 s, then look closely around 64-70 s (intro to rebuilt section), 239-245 s (rA to rB), and the last 6 s. Check for overlapping or clipped text, labels hidden under cards, empty or near-empty frames held too long, elements that pop in or out abruptly, frames that look unfinished, style clashes with the intro, and the ending (does it end cleanly, without a cut-off?). Compare the intro's look (orange LED clock, red route line, night imagery) with the rebuilt section.` },
  { key: 'audio', prompt: `${CONTEXT}

YOUR LENS: audio. Measure loudness with ffmpeg ebur128 (and astats) for the intro (0-67 s), the narration section (67 s to the end), and overall; check true peak and clipping. The target is about -16 LUFS integrated for both parts and a true peak at or below -1 dBTP. Check that the narration is continuous and unclipped, with no word cut at the join near 67 s and no lost lines. Compare narration text coverage with the original by checking that the edit's audio from 67.033 s matches the original from 71.7 s: cross-correlate a few windows, or compare silencedetect maps. Check that the ambient bed and sound cues (blips, pings, soft hits) are subtle and do not mask speech: estimate the bed level in pauses between sentences. Check that audio and video durations match and that the file ends cleanly.` },
]

phase('Inspect')
const out = await pipeline(
  LENSES,
  (l) => agent(l.prompt, { label: `inspect:${l.key}`, phase: 'Inspect', schema: FINDINGS }),
  (res, l) => {
    if (!res || !res.findings.length) return { lens: l.key, checked: res ? res.checked : [], findings: [], verdicts: [] }
    const list = res.findings.map((f, i) => `${i + 1}. [${f.time}${f.scene_time ? ' / ' + f.scene_time : ''}] (${f.severity}) ${f.problem}\n   Evidence: ${f.evidence}\n   Proposed fix: ${f.fix}`).join('\n\n')
    return agent(`${CONTEXT}

Another reviewer (lens: ${l.key}) reported the defects below. Be a skeptic: for each one, check it yourself (extract the frames or measurements) and decide whether it is real and worth fixing. Default to real=false unless you can see it. If real, state the best fix.

${list}`, { label: `challenge:${l.key}`, phase: 'Challenge', schema: VERDICTS })
      .then((v) => ({ lens: l.key, checked: res.checked, findings: res.findings, verdicts: v ? v.verdicts : [] }))
  },
)
return out.filter(Boolean)
