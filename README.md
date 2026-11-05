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
