# BeatAPI Design System

BeatAPI uses one original visual language across marketing, pricing,
authentication, Studio, Canvas, settings, and administration.

## Principles

1. **Creative work first.** The active project and media remain visually
   dominant; navigation and configuration stay quiet until needed.
2. **One action color.** Orange communicates the primary action. Cold blue is
   reserved for graph selection, connections, and structural focus.
3. **Cinematic product surfaces.** Near-black backgrounds, graphite cards,
   warm-white type, and restrained borders keep images and videos prominent.
4. **Editorial marketing.** Public pages use generous rhythm, strong headings,
   real product imagery, and clear technical proof instead of decorative noise.
5. **Shared behavior.** Studio and Canvas use the same composer, model language,
   assets, progress states, account controls, and billing entry points.

## Core tokens

- Background: near black.
- Raised surface: graphite.
- Primary text: warm white.
- Secondary text: neutral gray.
- Primary action: BeatAPI orange.
- Graph selection: cold blue.
- Success, warning, and error colors appear only for status communication.

Theme values live in `src/styles/globals.css`. Product code should consume the
shared variables instead of introducing one-off color systems.

## Typography

- Space Grotesk: display and product headings.
- Figtree: interface and body copy.
- Geist Mono: identifiers, parameters, model metadata, and technical values.

## Surfaces

### Marketing

Marketing pages explain the product through outcomes, workflow screenshots,
provider capabilities, and deployment ownership. Sections use durable
components with localized content supplied by blocks.

### Pricing

Pricing uses a linkable page and a shared modal. Plan hierarchy, billing period,
credits, and calls to action remain readable without competing visual accents.

### Studio

Studio is the guided, form-first view. It emphasizes one prompt, one active
configuration, and one result path.

### Canvas

Canvas is the node-based view for multi-step workflows. React Flow is the graph
engine, while the BeatAPI project document remains the canonical persisted
state. Selected nodes and edges use cold blue; generation actions use orange.

### Administration

Admin and settings screens favor dense, predictable forms and tables. They use
the same typography, spacing, controls, and status semantics as the workbench.

## Accessibility

- Interactive controls require visible focus styles and keyboard access.
- Color is never the only status signal.
- Dialogs must expose names, descriptions, focus restoration, and escape
  behavior.
- Motion respects reduced-motion preferences.
- Text and controls target WCAG AA contrast.
- Responsive behavior is checked at phone, tablet, laptop, and wide desktop
  widths.
