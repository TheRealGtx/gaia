---
name: GAIA Design System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#a43a3a'
  on-tertiary: '#ffffff'
  tertiary-container: '#fc7c78'
  on-tertiary-container: '#711419'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3af'
  on-tertiary-fixed: '#410005'
  on-tertiary-fixed-variant: '#842225'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.025em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.005em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  mono-data:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system delivers an operational interface tailored for planetary observation, environmental risk mitigation, and real-time emergency telemetry. Merging high-density utility with the polished restraint of contemporary desktop tools, the visual language balances pure neutrals against high-visibility status signals.

The aesthetic philosophy centers on clarity and quiet authority:
- **Style Archetype:** Minimalist High-Precision Telemetry. Surfaces remain pristine, flat, and light, allowing high-fidelity geospatial layers and data streams to command primary attention without chromatic noise.
- **Atmospheric Posture:** Pure optical whites, cool slate structures, ultra-faint borders, and restrained elevation. Structural frames prioritize negative space to reduce cognitive fatigue during extended crisis monitoring.
- **Status Telemetry:** The UI relies on definitive semantic anchors: crisp emerald for calibrated safety, focused amber for imminent thresholds, and surgical crimson for critical events.

## Colors

The palette employs an optical hierarchy calibrated for data density and instant status recognition on light backgrounds:

- **Primary (`#10B981`):** Represents operational stability, nominal readings, active verified links, and validated safe zones.
- **Secondary (`#0F172A`):** Deep slate-black reserved for high-priority typography, active control anchors, and structural command rails.
- **Neutral Palette:**
  - Canvas Base: `#FFFFFF`
  - Subtle Surface Alt: `#F8FAFC`
  - Subtle Structural Borders: `#E2E8F0` and `#F1F5F9`
  - Secondary Text / Meta-details: `#64748B` and `#475569`
- **Functional Semantics:**
  - Warning / Risk: `#F59E0B`
  - Fire / Critical Emergency: `#EF4444`
  - Neutral Sensor Inactive: `#94A3B8`

Surfaces stay bright and neutral; color is strictly functional, never purely decorative.

## Typography

Typography relies on `Inter` across all structural tiers to maintain clinical legibility and geometric alignment.

- **Tabular Figures:** All numerical readings, coordinate grids, and timestamp telemetry must render with tabular figures (`font-variant-numeric: tabular-nums`) to prevent shifting layouts across stream intervals.
- **Tracking Discipline:** Larger headline styles deploy subtle negative letter-spacing for tight spatial balance. Technical badges and micro labels shift to positive letter spacing with uppercase transformation to ensure scanability at sub-12px sizes.

## Layout & Spacing

The layout model leverages a dynamic 12-column grid bounded by a maximum viewport envelope for situational dashboards, flanked by modular collapsible side-panels.

- **Layout Model:** A fluid-grid base adapting to high-density monitor consoles. Dashboards snap to fixed left control modules (`280px` standard) with the central viewport dynamically filling data canvas regions.
- **Rhythm & Grid:** Built on an absolute 4px base increment (`0.25rem`). Gaps between telemetry widgets stay tightly bound to `0.5rem` or `1rem` to maintain contextual unity, while page margins preserve a generous `2rem` breath on widescreen platforms.
- **Breakpoints:**
  - `Mobile` (< 768px): Single-column reflow; side rails transform into bottom operational sheets; gutter drops to `1rem`.
  - `Tablet` (768px - 1199px): 8-column layout; technical side rails become drawer overlays.
  - `Desktop` (≥ 1200px): Full multi-pane 12-column layout with pinned live monitors.

## Elevation & Depth

Visual hierarchy uses flat micro-structural definition over stacked drop shadows, leaning on subtle borders, glass overlays, and restrained ambient diffusion:

- **Border Hierarchy:** Separation is defined primarily by 1px borders using `#F1F5F9` for secondary cards and `#E2E8F0` for primary panels and inputs.
- **Floating Overlays & Glass:** Floating situational monitors and map badges use backdrop-filter blur (`backdrop-filter: blur(12px)`) with semi-transparent surfaces (`rgba(255, 255, 255, 0.85)`) coupled with a subtle inner border (`rgba(255, 255, 255, 0.6)`).
- **Ambient Shadow Scale:**
  - `Elevated Low`: `0 1px 2px 0 rgba(15, 23, 42, 0.04)` for static interactive cards.
  - `Elevated Medium`: `0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.03)` for active popovers and data dropdowns.
  - `Elevated High`: `0 12px 24px -4px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.03)` reserved for critical emergency intervention modals.

## Shapes

The design system standardizes on calibrated rounded geometry (`roundedness: 2`), delivering smooth modern contours while preserving enterprise structure:

- **Base Radius (`0.5rem` / `8px`):** Used across input fields, tactical buttons, system badges, list row selections, and telemetry chips.
- **Large Radius (`1rem` / `16px`):** Applied to central cards, analytical map widgets, popover dialogs, and situational panels.
- **Extra-Large Radius (`1.5rem` / `24px`):** Reserved for primary layout modules, command drawers, and floating map viewport enclosures.

## Components

### Buttons
- **Primary Action:** Solid `#0F172A` background, white label, `0.5rem` corner radius, micro-transition on hover (`#1E293B`). Focus states utilize a 2px outer ring offset in `#10B981`.
- **Status Urgent:** Solid `#EF4444` background with crisp white label for immediate emergency actions (e.g., dispatch, broadcast).
- **Secondary / Ghost:** Transparent background, `1px solid #E2E8F0`, `#0F172A` text, hovering to `#F8FAFC`.

### Chips & Telemetry Status Badges
- **Structure:** Pill or `0.5rem` rounded badges containing a leading 6px pulsing dot indicator.
- **Safe:** `background: #ECFDF5`, `color: #065F46`, `border: 1px solid #A7F3D0`.
- **Warning:** `background: #FFFBEB`, `color: #92400E`, `border: 1px solid #FDE68A`.
- **Critical:** `background: #FEF2F2`, `color: #991B1B`, `border: 1px solid #FECACA`.

### Cards & Analytical Panels
- Flat white fill (`#FFFFFF`), `1px solid #E2E8F0` border, `1rem` corner radius, padded with `1.5rem`. Header areas feature a hairline bottom divider (`#F1F5F9`) separating metadata controls from telemetry graphs.

### Inputs & Search Bars
- Background `#FFFFFF`, border `1px solid #E2E8F0`, text `#0F172A`, placeholder `#94A3B8`.
- Focus active state: Border shifts to `#10B981` with an ambient glow (`box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15)`).

### Lists & Incident Feeds
- Borderless internal rows with an alternating micro-divider (`#F1F5F9`). Interactive rows feature an instant subtle background shift (`#F8FAFC`) on hover with an active left-edge 2px vertical accent bar showing the respective alert level.

### Checkboxes & Toggle Radios
- Crisp `0.25rem` radius on checkboxes. Unchecked: `1.5px solid #CBD5E1`. Checked: Solid `#10B981` with white checkmark icon. Smooth 150ms ease-out on state transition.
