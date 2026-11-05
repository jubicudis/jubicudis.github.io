# TNOS — interactive visual design study

**Public website:** https://jubicudis.github.io/  
**Sponsorship:** https://github.com/sponsors/jubicudis

This repository hosts a browser-based presentation **about** Tranquility Neuro Operating System (TNOS), not the native TNOS OS, Violet AI model, or a completed Workbench.

## Current visual prototype

On Jubi's instruction, the former conventional box-and-menu homepage was replaced with an initial integrated spatial experience for direct inventor review.

The root experience now has:

- A persistent visual environment with a recognizable, nonhuman Violet presence whose movement and geometry relate to the active explanation.
- An opening conversation with an optional preferred name, kept only in memory in the browser tab.
- A seven-subject guided introduction derived from the *public draft direction* of the Sponsors master, with concise explanations and distinctions between intended architecture, partial implementations and independently demonstrated outcomes.
- Interactive seven-context geometry, architecture frames, development-history relationships, and a Workbench *browser-only illustrative* carriage request/observation example.
- Spatially anchored subject selection, greater explanation depth, interruption, return, caption text, reduced-motion control, and mobile layout.
- Three.js scene rendering when the external module and WebGL are available, with a local 2D canvas fallback. The Three.js dependency is fetched from jsDelivr at runtime; the site is not a fully offline experience.

**Design status:** This is a functional **visual design proposal**, not an approved visual identity, final copy, completed AI assistant, native TranquilSpeak execution, verified hardware observation, or the finished GitHub Sponsors presentation. The master document's private audit was never added to this public repo.

The website's actual logic is in `assets/spatial.js`, the presentation styling is in `assets/spatial.css`, and the entry point is `index.html`. Browser acceptance checks were exercised locally before publishing.

## Existing work

`src/core/content.mjs`, `src/core/experience.mjs`, and `src/core/violet.mjs` remain as earlier architectural experiments. The new integrated visual study is currently self-contained and **does not yet use those modules as its authoritative state engine**. Integrating and validating a consolidated engine is later work; do not claim the two implementations are already connected.

The earlier control-based preview remains under `preview/` for comparison, not as the intended design.

## Continuing the collaboration

Use the published visual experience to evaluate Violet's form, spatial composition, wording, animation, information relevance, interaction and comfort on actual devices. Decisions are to be based on their communication purpose, not presentation decoration. Changes are evaluated visually and functionally before representing them as completed work.

The user-facing name is **Jubi / Jubicudis**. Violet is Jubi's developer AI identity in the proposed TNOS product; the browser version is a visualization, not the native AI.
