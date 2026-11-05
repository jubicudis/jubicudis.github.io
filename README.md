# TNOS — Public presentation website

Public companion to [GitHub Sponsors](https://github.com/sponsors/jubicudis).
The site is a presentation **about** Tranquility Neuro Operating System, its Workbench, and its separate MCP server. It is not the TNOS operating system or its cognitive runtime.

## Established experience

- One persistent browser environment: a guided, TED-style talk by a scripted animated presenter, followed by free exploration.
- Presentation and exploration retain the same context. Visitors can interrupt a talk, explore a related subject, and return without restarting the entire experience.
- Captions are mandatory; optional narration and animation must coordinate with established presentation outcomes.
- Public claims distinguish intended behavior, implemented software, and demonstrated results.
- Interactive examples must show something meaningful supported by real work or a defined intended experience. Do not add features just to display a technology.
- The browser experience never assumes a visitor has understood something merely because content appeared.
- No visitor camera or microphone is needed. Visual observation, when justified, concerns the site's own output.

## Foundation on branch `site-foundation`

`src/core/content.mjs` owns admission of inventor-approved public claims, related topics, and scripted cues. It refuses unapproved copy or unsupported claim classifications. The full working Sponsors master, including its private audit, is **not** part of this repository.

`src/core/experience.mjs` owns a single visitor experience: welcome, guided talk, contextual interruption, return, and exploration. It produces presentation requests and accepts separately supplied observation results. Each request has a generation, so a stale observation cannot qualify a later request. Failed or unavailable results are not converted into success.

Together these form the **nonvisual foundation**, not a finished website. They are dependency-free browser ES modules. No AI model, server, telemetry, webcam, or sitewide computer-vision loop is required.

## Boundaries for the next construction layers

1. **Public content:** Curate and approve the full TNOS/Workbench/MCP narrative and supporting evidence from Part I of the current master. Never copy Part II into a public bundle.
2. **Presentation:** Design the animated stage, character, readable dialogue/captions, and meaningful supporting material with the inventor. This visual design is **not decided** by the foundation.
3. **Coordination:** Connect actual render and media adapters to the foundation's requests and observation channel. Choose the cheapest reliable observer for each required result; use OpenCV only if its visual evidence adds value.
4. **Exploration:** Present approved related subjects through the same interface. Preserve accessible navigation and direct links without inventing architectural attractions.
5. **Verification and release:** Exercise pause/return, old-generation rejection, audio/caption synchronization, mobile behavior, reduced-motion accessibility, and content-approval boundaries. Only then connect an approved presentation to the root `index.html`.

The default Pages branch `main` intentionally retains an empty `index.html` until the user-facing design and public content are approved. This branch is for foundational implementation review, not a public-site launch.


## Violet — communication layer (implementation in progress)

\`src/core/violet.mjs\` is an independent communication-policy layer cooperating with the existing experience engine. It does **not** replace the experience engine's authority over presentation position, observations, or checkpoint state.

**Identity:** Violet is the name of Jubi/Jubicudis's developer AI instance and the intended introductory identity in future TNOS onboarding. A TNOS user would later be able to personalize and rename their own AI or retain Violet. The browser Violet is an explicitly authored *representation of the intended interface*, not the native AI or a working TNOS cognitive prototype.

**Opening assumption:** Arriving at the page is sufficient reason to begin explaining TNOS. Do not ask visitors whether they wish to learn more or presume they are experts or beginners. The first exchange may invite a preferred name; providing it must remain optional. The name is session-memory-only, is not an account identity, and is never a basis for inferring expertise, identity verification, or sponsorship eligibility.

**Communication:** A provisional authored greeting establishes the exchange; subsequently the visitor's explicit choices establish direction. A configurable route supplies a reasonable default rather than a forced sequence. Topic relationships make contextually relevant alternatives available. Public claims are selected from an approved content catalog; the engine does not improvise technical claims. Supporting narration, animation, and the spatial environment will be connected after their functional responsibilities are established.

**Seven contextual questions for the website (not native TranquilSpeak execution):**

- WHO: optional self-provided name, otherwise unknown.
- WHAT: the current approved TNOS subject.
- WHEN: the state of the presentation/exploration.
- WHERE: the visitor's position within this website experience, **not physical location**.
- WHY: the intent the visitor actually expressed through an interaction, never a guessed reason for visiting.
- HOW: the chosen delivery preference; captions remain available.
- EXTENT: the chosen overview or deeper explanation, not a presumed education level.

**Communication objectives:** The site can define approved topic-coverage objectives—why we want the visitor to encounter the material. The observer may establish that material was presented. The site must **not** claim the person understood it, was persuaded, or intends to sponsor. Sponsorship is an informed voluntary decision. Do not use pressure tactics, behavioral profiling, or fabricated demonstrations.

### Practical integration sequence

1. Curate approved *public* claims from the existing Part I master, then their topics, relationships, overview/detail references, and presentation cues. Part II remains private.
2. Specify the inventor-approved introductory greeting and default topic route, with optional name and skip behavior. Tests use synthetic text only.
3. Bind the authorized state/effect outputs to actual accessible browser controls, captions, and presentation rendering. Render visitor-supplied names as text, never as HTML.
4. Qualify text/visual/audio presentation results using appropriate observation adapters. Only render the next dependent state from actually established outcomes; use heavier visual tools only for a justified requirement.
5. Collaboratively select Violet's expressive form, geometry, movement, and placement **with** the environment. Target the experience of communicating with a computer system, not talking to a separate synthetic person. No final artwork, styling, or voice has been chosen.
6. Test the complete experience and approve public content/art before building the root Pages entry point and publishing.

**Status:** Core communication policy and engine observations have automated Node tests in \`tests/violet.test.mjs\` (run \`node --test tests/*.test.mjs\`). No speech engine, model, rendered stage, computer-vision adapter, browser UI, visitor analytics, or published website has been implemented in this layer.
