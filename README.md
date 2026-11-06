# TNOS public presentation — current implementation

This repository is the **public presentation**, not the private TNOS operating-system source. It introduces the invention and leads to [GitHub Sponsors](https://github.com/sponsors/jubicudis).

The source of public claims is Part I of the TNOS Sponsors working master (v3.9, November 5, 2026), interpreted together with later inventor decisions on Violet and the website. Part II of that master is a private audit history and is not copied here. The full verbal script and final website composition remain subject to inventor review.

## What this code actually does

- Opens on Violet as the only visible interactive element.
- Animates an original browser-SVG Structured Bloom body, inspired by four interconnected structural elements. This is the website character, **not** the running TNOS operating system.
- Supports name entry or skipping; the choice stays in page memory and is not transmitted.
- Presents source-grounded narrated passages and generated explanatory diagrams about the intended OS, its origins, its context and stages, the separate Workbench and MCP server, development progress, and sponsorship.
- Keeps the current presentation passage as the authoritative checkpoint when a visitor branches into subject exploration and then returns.
- Separates requested Violet visibility from the observed completion of her fade/recall transition. Her central face closes and remains as a minimal recall marker while the strands disappear.
- Exposes actual browser speech synthesis with captions, where the visitor's browser supports it. The browser's available voices are not a custom recorded Violet voice.
- Makes no API calls, uses no tracking, and has no AI model or backend.

There are no intentionally nonfunctional placeholder controls. The diagrams are authored explanations, not screenshots of native TNOS execution.

## Architecture / ownership

- site/content.mjs owns the current public explanation material and evidence qualifications.
- site/state.mjs owns visitor, chapter, context, narration, presence, and checkpoint state. An event may change only an allowed state. The seven questions provide **website** context, not a claim that TranquilSpeak runs in the browser.
- site/visuals.mjs draws explanation-specific SVG diagrams from known relationships.
- site/app.mjs consumes the state to render it, dispatches user actions and speech events, and makes a bounded **DOM layout-only** observation. Layout presence does not prove actual pixels, comprehension, or TNOS behavior.
- site/styles.css realizes the visual form, constrained movement, responsive layout, and reduced-motion behavior.

Run locally with a static HTTP server (for example, python3 -m http.server 8000 from the repository root), then open http://localhost:8000. Run pure-state regression tests with node --test tests/*.test.mjs.

## Required work still open — not optional or silently declared finished

- Inventor review of the current narration, chapter sequence, visual direction, and full-length public site content relative to the complete Sponsors master.
- Actual browser and device verification of visuals, audio, keyboard access, transitions, and mobile presentation. State unit tests alone cannot validate visual quality.
- A source-qualified rendered-output observation implementation in the website's own presentation environment, including the OpenCV requirement described in the master. The current DOM layout check is explicitly **not** OpenCV pixel observation.
- Further presentation/exploration depth and actual approved evidence as it becomes available. Simulated illustrations must remain distinguishable from working TNOS, Workbench, or MCP demonstrations.
- Exact animation and recorded voice decisions if the inventor subsequently specifies them. Unlimited soft-body physics is not implemented or represented as necessary.

Do not treat a passing state test, a renderer call, or this README as evidence that the complete requested website is finished. Continue the work on the existing main branch, refining authoritative files in place.
