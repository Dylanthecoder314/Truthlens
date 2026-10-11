# Build prompt: Journey of Misinformation

Build a 2D browser game called **Journey of Misinformation**, inspired by Nicky Case's *We Become What We Behold* (https://ncase.me/wbwwb/). Credit it in the game.

**Context.** This is the creative product for a school project (NSW "Freedom to Learn", Semester 2 2026). The theme is "Myth, Mystery and Misunderstanding", with the question "Why do humans create stories to explain what they do not understand?" Our group's topic is fake news and how AI will influence social media. The project needs three connected products: research, creative (this game) and presentation, where we play-test the game with a real audience in week 8. It fits the "Fighting Misinformation" task and the "Semi-Negotiated Task" option, which allows merging projects.

---

## 1. Core idea

You decide what people see. In each scene you aim a camera frame at a 2D world, choose how tightly to crop, and publish. A crowd of little people (called "the public") reacts to *your version*, not to what really happened. Every event can be told several ways, and each choice leads to a different outcome.

## 2. Structure

The main menu has two pages.

1. **Real Events.** Style it like our Canva slide "Journey of Misinformation": a grey road with a dashed white centre line curving up to an arrow, with stops in date order:
   - 1963: Assassination of John F. Kennedy
   - 2001: 9/11 conspiracy theories
   - 2014: Malaysia Airlines flight MH370
2. **Imaginary Events.** Fama, the Roman goddess of rumour (Virgil, *Aeneid* Book 4). She starts small, grows as she travels, and has as many eyes, tongues and ears as feathers. She lives in a made-up town where nothing that happens is real, and every share makes her bigger.

Each real-event chapter has **two halves**:
- **Then:** the event in its own era and media (newspapers and film, TV, early internet, 2014 social media).
- **Now:** the same event in 2026 on a social feed. An **AI button** can "enhance" photos, fake documents, clone voices and invent posts.

What happens in one chapter carries into the next. For example, if the JFK theory wins, the 2001 crowd starts out distrusting official reports.

## 3. Core mechanics

- **Viewfinder.**
  - The mouse moves the frame. Touchscreens drag it; arrow keys move it too.
  - Scroll, `-`/`+` or on-screen buttons resize the frame (3:2 aspect) from a tight crop (84px wide) to a wide shot (300px).
  - Click, Space or the camera button publishes.
- **How a shot is classified.** Each event defines invisible tagged points, such as `umbrella` and `crowd`. The tags inside the frame decide which version of the story you published:
  - a tight crop that hides the context is a theory;
  - a wide shot that includes the context is the truth, or an honest "we don't know".
- **Timing matters.** Some context is only in shot for a few seconds.
- **Missed shots.** A shot with nothing relevant shows a toast ("Nothing worth publishing in that shot") and costs a few readers. If you never publish before the event's timer runs out, the event counts as **ignored**.
- **The photo.** The photo is a real crop of the scene: render the world to an offscreen canvas at 2× and crop it.
  - Newspaper eras get a halftone dot filter.
  - The TV era gets sepia and scanlines.
  - The phone era stays crisp.
- **Publishing animation.** Each medium has its own:
  - a spinning newspaper front page (masthead, date, headline, photo);
  - a 1970s TV with a news lower-third;
  - a phone post whose like and share counters climb.

  Afterwards it flies into a display in the bottom-left of the public strip (a newsstand, a TV or a giant phone).
- **Story kinds and their effects.** Each kind changes reach (readers, viewers or followers), trust, and the crowd's belief:

  | Kind | Reach | Trust | Belief shift |
  |---|---|---|---|
  | theory | +14 | −8 | +0.30 |
  | truth (accurate but dull) | −12 | +8 | −0.22 |
  | reveal (true *and* dramatic) | +6 | +10 | −0.28 |
  | honest (balanced, or "unknown") | −6 | +5 | −0.08 |
  | aifake | +24 | −16 | +0.42 |
  | labelled (posted with context) | −4 | +12 | −0.30 |
  | debunk | +6 | +12 | −0.30 |
  | ignored | −8 | 0 | 0 |

- **The pressure.** Scary stories bring readers and boring truths lose them.
  - If reach hits 0, the chapter ends early ("The Paper Folds": someone louder takes over).
  - The good outcomes depend on finding moments that are true *and* interesting.
  - Start each chapter at reach 60 and trust 55.
- **The public.**
  - 16 "peeps" stand in a strip along the bottom.
  - Each has a belief value from −1 (follows evidence, teal) to +1 (suspects a plot, red), shown by colour and facial expression.
  - **Confirmation bias:** people who already lean strongly one way move much less when shown the other side.
  - **Group pressure:** neighbours slowly pull each other's beliefs together.
  - Speech bubbles show reactions ("!?", "oh.", "?", "!!").
- **HUD.** It shows:
  - the year and place;
  - a reach meter that pulses red when low;
  - a trust meter;
  - a legend for the two crowd colours.

  A ticker under the stage describes what's happening in plain words.
- **AI composer (the "Now" halves).** After you capture, a post composer opens with options such as:
  - **✨ Enhance with AI:** huge reach, but fake.
  - **Post as is:** uses your framing.
  - **🔍 Check with TruthLens:** the in-game fact-checker, named after our TruthLens project. It shows a scanning animation, reveals findings one at a time, then offers "Post with context" or "Post the debunk".
  - **Don't post.**
- **Year cards** between eras, e.g. "1963 · Dallas, Texas · You are a newspaper photo editor."
- A **How to play** modal at the start, and a **pause menu** (Esc) with resume, how to play, sound on/off and quit.

## 4. The debrief ("Museum") after each chapter

- The ending's title, what it means, and a "what really happened" line.
- **Your journey:** a road-style timeline. Each event shows:
  - the year;
  - the photo you published and your headline;
  - a tag for the story kind;
  - the paths you didn't take, greyed out;
  - a short "what really happened" fact.
- A crowd summary: how many of the 16 follow the evidence and how many suspect a plot.
- **Endings found X / 6** per chapter. Save it in `localStorage`, wrapped in try/catch. Locked endings show as "???".
- A **sources** list we can reuse in our research product.
- Buttons: Play again, Back to menu.
- Optional: a short "spot the misleading post" quiz before and after playing, as data for our week 8 audience testing.

## 5. Chapter 1: JFK (fully designed)

| Era | Setting | Medium | Meter label |
|---|---|---|---|
| 1963 | Dealey Plaza, Dallas: Book Depository, grassy knoll with pergola and picket fence, trees, rail yard with boxcar, triple underpass, Elm Street, "Stemmons Fwy" sign | Newspaper, *The Evening Courier* (fictional) | Readers |
| 1964 | Press room, Washington D.C. | Newspaper | Readers |
| 1978 | Congressional hearing room, Washington D.C. | TV news | Viewers |
| 1991 | Cinema street at night | Newspaper | Readers |
| 2026 | Dealey Plaza today, tourists with phones | Phone, "Courier Now" | Followers |

**Events** (tight crop vs wide shot):

1. **The Umbrella Man (1963).** A man on the north curb pumps an open black umbrella up and down on a clear, sunny day.
   - **Crop on the umbrella only → theory:** "UMBRELLA ON A SUNNY DAY: WAS IT A SIGNAL?"
   - **Include the neighbours in shirtsleeves → honest:** "ODD UMBRELLA ON A CLEAR DAY. NO ONE KNOWS WHY."
   - *Fact:* in 1978 Louie Steven Witt told the House Select Committee on Assassinations that he brought it to heckle Kennedy. It was a jab at Joseph Kennedy Sr.'s support for Neville Chamberlain's appeasement policy.
2. **Behind the Fence (1963).** Leaf shadows dapple the picket fence on the grassy knoll, and one dark blob looks like a head and shoulders.
   - **Crop on the shadow only → theory:** "A GUNMAN BEHIND THE FENCE?"
   - **Include the tree canopy → truth:** "SHADOWS ON THE KNOLL FENCE: JUST LEAVES."
   - *Fact:* witnesses disagreed about where the shots came from, because echoes in the plaza confused them. In the early 1980s, researchers enlarged a blurry Polaroid (the Moorman photo) and claimed to see a figure ("Badge Man"). Experts say the photo lacks the resolution to show anything, and enlarging a photo can't add detail that was never captured.
3. **Three Men From a Boxcar (1963).** Police lead three men out of a railway boxcar, then walk them down to the road.
   - **A shot that includes the boxcar** (only possible early, or with a wide frame) **→ truth:** "POLICE QUESTION THREE DRIFTERS FOUND IN BOXCAR."
   - **Without the boxcar → theory:** "MYSTERY MEN ARRESTED, THEN RELEASED: WHO WERE THEY?"
   - *Fact:* their arrest records were released in 1989. In 1992, journalist Mary La Fontaine matched them to Gus Abrams, Harold Doyle and John Gedney, who were ordinary drifters.
4. **The Commission Reports (1964).** A spokesman presents the report while a man at the back holds a sign reading "WHAT ARE THEY HIDING?"
   - **Report only → truth:** "REPORT: ONE MAN ACTED ALONE."
   - **Both → honest:** "REPORT SAYS ONE GUNMAN. CRITICS AREN'T CONVINCED."
   - **Sign only → theory:** "WHAT ARE THEY HIDING?"
   - *Fact:* the Warren Commission (September 1964) concluded that Lee Harvey Oswald acted alone. In 1979 the House committee said there was "probably" a conspiracy, mainly because of a police radio recording. In 1982 a National Academy of Sciences panel found that those sounds were recorded about a minute after the shooting.
5. **The Umbrella Man Speaks (1978, on TV).** Witt testifies, opens the umbrella, and a speech bubble explains why. Paraphrase it; don't present it as a direct quote.
   - **Umbrella without the explanation → theory:** "UMBRELLA MAN RESURFACES. WHO SENT HIM?"
   - **With the explanation → reveal:** 'UMBRELLA MAN: "IT WAS A PROTEST"'
   - If the player published the "signal" theory in event 1, believers resist this reveal.
6. **Now Showing (1991).** A cinema shows a film about the assassination. The marquee says it's a Hollywood drama, while the poster says "WHAT REALLY HAPPENED?"
   - **Poster only → theory:** "NEW FILM REVEALS WHAT REALLY HAPPENED."
   - **With the marquee → honest:** "HOLLYWOOD DRAMA REVIVES OLD THEORIES."
   - *Fact:* Oliver Stone's *JFK* (1991) mixed real events with invented scenes and composite characters. It also pushed Congress to pass the 1992 JFK Records Act, which released millions of pages of files.
7. **Enhance! (2026).** A tourist films the same fence, and the AI composer opens.
   - **✨ Enhance with AI:** the AI invents a sharp face, cap and badge in the shadow → aifake: "AI ENHANCED: the grassy knoll gunman, finally revealed 😳"
   - **Post as is:** a theory or the truth, depending on your framing.
   - **TruthLens check → labelled:** "AI 'enhance' tools guess. They don't uncover hidden detail."
8. **The Lost File (2026).** A "leaked secret JFK file" is going viral. It has a typewriter look, a SECRET stamp and black redactions.
   - **Share it → aifake.**
   - **TruthLens check:** no such file number exists in the National Archives collection, the "typewriter" letters are a modern font, and the image was made with an AI tool this week → **debunk**.
   - **Don't post → ignored.**
   - *Fact:* the National Archives released the real files in batches (2017, 2022–2023, 2025).

**Endings, checked in this order:**
1. **The Paper Folds:** reach hit 0.
2. **Enhanced History:** 2 or more AI fakes posted. Anyone searching for the truth now finds your fakes first.
3. **Odd Isn't Evidence** (secret): no theories at all, the umbrella told honestly, the enhance post labelled, and the file debunked.
4. **The Theory Wins:** 4 or more theory or AI-fake posts.
5. **Set the Record Straight:** 5 or more truthful posts and at most 1 theory.
6. **A Divided Public:** everything else.

Real-world line for the endings: Gallup found 52% of Americans believed others were involved in 1963, 81% in 1976 and 2001, and 65% in 2023.

**Sources** (checked):
- https://www.archives.gov/research/jfk/available-online
- https://www.archives.gov/research/jfk/warren-commission-report/chapter-1
- https://www.archives.gov/research/jfk/select-committee-report/summary.html
- https://nap.nationalacademies.org/10264 (1982 acoustics report)
- https://www.jfk-assassination.net/russ/jfkinfo2/jfk4/witt.htm (Witt testimony)
- https://en.wikipedia.org/wiki/Three_tramps
- https://en.wikipedia.org/wiki/Badge_Man
- https://news.gallup.com/poll/1813/most-americans-believe-oswald-conspired-others-kill-jfk.aspx

## 6. Chapter 2: 9/11 (still to design; verify every fact first)

- **Never show the attacks.** Show only how the theories spread afterwards.
- **Then (2001–2006):** forums, chain emails, and a viral online documentary (*Loose Change*, 2005).
  - The trick is the **quote out of context**: trim a TV interview so a remark about pulling firefighters out sounds like a confession of demolition. This is the real "pull it" theory, from a 2002 PBS documentary.
  - Context to include: the 9/11 Commission Report (2004), and the NIST reports on the towers (2005) and on WTC 7 (2008).
- **Now:** an AI voice clone produces a fake "confession" audio clip, which TruthLens can check.

## 7. Chapter 3: MH370 (still to design; verify every fact first)

- **Background:** the flight vanished on 8 March 2014 with 239 people aboard. A piece of wing (a flaperon) was found on Réunion Island in 2015, but the main wreckage has never been found. Treat it respectfully, with no crash imagery.
- **Then (2014):** social media fills with theories, plus clickbait "MH370 FOUND" scam videos on Facebook.
  - The trick is the **clickbait thumbnail**.
  - This chapter is a mystery with many explanations, so the honest option is "still unexplained".
- **Now (2023 onward):** viral "orb" videos claimed to show MH370 being teleported. They were debunked as being built from an old visual-effects asset and stock cloud photos. Also include AI-generated "wreckage found" images.

## 8. Imaginary Events: Fama (still to build)

- **The town:** a fictional village by a lake.
- **Events:**
  - a log rolling in the lake;
  - glowing eyes in the dark (an owl);
  - a missing sheep (the honest answer is "still unexplained");
  - a stranger who rescues a child (the framing decides hero or villain);
  - a lightning strike (superstition vs. natural cause).
- **Fama grows:** each scary story adds feathers, eyes and tongues to her, until she spreads her wings over the town. A monster also gets painted on the rock wall, one body part per story.
- **Endings:** The Monster Is Born, The Stranger Is Driven Out, The Guardian of the Deep (a useful myth that keeps kids away from deep water), Still Unexplained, Another Voice (you ran out of listeners), and a secret ending, Stories from Across the Water.
- **Possible final act:** a near-future AI town where the AI generates events that never happened.

## 9. Sensitivity rules

- These events involve real deaths. Use simple abstract shapes, and never show violence, weapons, the moment of the assassination, the attacks or a crash.
- Every chapter ends with what the evidence actually shows, plus sources.
- Don't present invented quotes as real; paraphrase instead. Don't depict real private individuals.
- Use fictional names for the in-game news outlets.

## 10. Look and tech spec

- **Tech:** plain HTML, CSS and JavaScript with no build step. It must run in any browser, including school Chromebooks. Use classic `<script>` tags so it also opens straight from the file.
- **Files:** a `game/` folder containing `index.html`, `style.css`, `js/audio.js`, `js/draw.js`, `js/engine.js`, `js/chapters/*.js` and `js/main.js`.
- **Canvas:** 960×540 logical pixels on a 16:9 stage that scales to the window and is DPR-aware. The top 400px is the world you photograph and the bottom 140px is the public strip. A control bar under the stage holds the ticker and the Crop, Wide, Publish and Pause buttons.
- **Colours** (to match our slide):
  - warm charcoal `#252321`
  - newsprint `#eee7d8`
  - violet `#7a6cff` (the player's actions)
  - lime `#a9d64f` (good outcomes)
  - red `#e4583f` (suspects a plot)
  - teal `#4fb0ad` (follows evidence)
- **Fonts:** Space Mono for the UI, Old Standard TT for newspaper headlines, Special Elite for typewritten documents, all with fallbacks.
- **People ("peeps"):** round bodies with dot eyes.
  - Moods: calm, suspicious, angry, shocked, happy, confused.
  - Hats by era: fedoras and pillbox hats in 1963, caps in 1991, phones in hand in 2026.
  - Props: umbrella, sign, phone, report, camera.
- **Era palettes:** muted sepia-grey for 1963, warm faded colour for 1978, neon night for 1991, bright for 2026.
- **Sound:** synthesised with Web Audio (shutter, whoosh, paper thud, phone ping, crowd murmur, chime), with a mute toggle.
- **Accessibility:** full keyboard controls, visible focus, `prefers-reduced-motion`, 44px touch targets, and a "turn your phone sideways" hint.

## 11. Build order

1. Engine, menu and the full JFK chapter. Play-test the branching.
2. 9/11.
3. MH370.
4. The Fama page.
5. The before/after quiz and feedback collection for week 8.
