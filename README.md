````markdown
# DoG Texture Studio

**Tagline:** Empowering developers and artists to effortlessly generate bump, normal, albedo, and emission maps from any image using Difference of Gaussians and advanced processing pipelines.

[Live Demo ↗️](https://santideva.github.io/DoGPDA)

---

## Table of Contents

1. [Overview](#overview)
2. [Features & Objectives](#features--objectives)
3. [Architecture & Data Flow](#architecture--data-flow)
4. [Core Concepts](#core-concepts)
5. [Module Reference](#module-reference)
   - [StateManager](#statemanager)
   - [UserInterface](#userinterface)
   - [DoGBumpMapper & ThreeJsDoGBumpMapper](#dogbumpmapper--threejsdogbumpmapper)
   - [BumpToNormalMapper](#bumptonormalmapper)
   - [AlbedoMapper](#albedomapper)
   - [EmissionMapper & ThreeJsEmissionMapper](#emissionmapper--threejsemissionmapper)
   - [Orchestrator (`index.js`)](#orchestrator-indexjs)
6. [Getting Started](#getting-started)
7. [Usage & Workflow](#usage--workflow)
8. [Customization & Extensibility](#customization--extensibility)
9. [Development & Build](#development--build)
10. [License](#license)

---

## Overview

**DoG Texture Studio** is a web-based application built on [Three.js](https://threejs.org/) that automates generation of four essential texture maps—**bump**, **normal**, **albedo**, and **emission**—from any source image. Leveraging the Difference of Gaussians (DoG) algorithm, separable convolution, and advanced pixel-level processing, it delivers real-time previews and instant PNG downloads.

Visit the **[Live Demo ↗️](https://santideva.github.io/DoGPDA)** to try it out!

---

## Features & Objectives

- **One-Click Texture Generation**  
  Automatically compute bump, normal, albedo, and emission maps.

- **Interactive Controls**  
  Real-time sliders, dropdowns, color-pickers, and checkboxes for fine-tuning.

- **Advanced Emission Modes**  
  Luminance, channel-extraction, color-key masking, threshold & exponent curves, blur, invert mask, tint color & intensity.

- **Modular & Extensible**  
  Swap or extend any mapper (e.g. alternative blur, new color modes) without touching core orchestrator.

- **Seamless Three.js Integration**  
  Instant in-scene previews on a rotating plane mesh, with full export/download support.

---

## Architecture & Data Flow

```mermaid
flowchart LR
  A[User Upload] --> B[UserInterface.handleFileSelect]
  B --> C[StateManager.updateState(resources)]
  C --> D[applyMaps(mapType)]
  D -->|case: bump| E[applyBumpMap → ThreeJsDoGBumpMapper]
  D -->|case: normal| E & F[applyNormalMap]
  D -->|case: albedo| G[applyAlbedoMap]
  D -->|case: emission| H[applyEmissionMap → ThreeJsEmissionMapper]
  E & F & G & H --> I[Three.js Material Update]
  I --> J[Renderer.render()]
  D --> K[UserInterface.updateDownloadButton]
```
````

1. **Initialization (`init` in `index.js`):**

   - Create **StateManager** with defaults (and load local storage).
   - Build Three.js scene (camera, lights, mesh).
   - Instantiate **UserInterface** with callbacks.
   - Trigger first `applyMaps`.

2. **User Interaction:**

   - **Image Upload:** UI reads file via **FileReader** → Data URL → State → Preview.
   - **Map Type Change:** Dropdown rebuilds parameter panel.
   - **Parameter Adjustment:** Sliders/dropdowns/color-pickers update state → debounced `applyMaps`.
   - **Apply / Download:** Manual apply button / download current map.

3. **Processing (`applyMaps`):**

   - Guard re-entrancy (`processingInProgress` / `pendingUpdate`).
   - Show spinner.
   - Invoke the appropriate map pipeline:

     - **Bump:** `applyBumpMap`
     - **Normal:** `applyBumpMap` → `applyNormalMap`
     - **Albedo:** `applyAlbedoMap`
     - **Emission:** `applyEmissionMap`

   - Update Three.js material channels accordingly.
   - Update state textures & Download button.
   - Hide spinner, handle queued updates.

---

## Core Concepts

- **Difference of Gaussians (DoG):** Two Gaussian blurs at different σ minus to detect edges → height variations for bump.
- **Separable Convolution:** Two 1D passes (horizontal + vertical) for performance.
- **StateManager:** Centralized store for options, flags, resources, textures; notifies subscribers.
- **Debouncing:** Prevents flooding of processing calls during rapid slider changes.
- **Three.js Textures:** Offscreen canvas → `THREE.Texture` → assigned to material (map / normalMap / emissiveMap).
- **Data URLs vs Blob URLs:** Data URLs (via FileReader) avoid manual URL revocation and CORS issues.

---

## Module Reference

### StateManager

**File:** `stateManager.js`
**Role:** Central application state; supports nested sections (`bumpOptions`, `normalOptions`, `albedoOptions`, `emissionOptions`, `flags`, `resources`, `textures`).
**Highlights:**

- `getState(section?)`
- `updateState(partial)`
- `subscribe(callback)` & `subscribeToSection(section, callback)`
- Local storage persistence

---

### UserInterface

**File:** `userInterface.js`
**Role:** Build & manage dynamic sidebar controls, handle file upload & preview, “Apply” & “Download” buttons, and advanced emission-mode UI.
**Key Methods:**

- `setupControls()`
- `renderParameterPanel(type)`
- `handleFileSelect(event)`
- `updateDownloadButton(type)`
- `downloadCurrent()`

---

### DoGBumpMapper & ThreeJsDoGBumpMapper

**File:** `js/DoGBumpMapper.js`
**Role:**

- **DoGBumpMapper:** Pure algorithm (blur, DoG, threshold, height mapping).
- **ThreeJsDoGBumpMapper:** Image loading, canvas orchestration, preview overlays, Three.js texture creation.

---

### BumpToNormalMapper

**File:** `js/BumpToNormalMapper.js`
**Role:** Convert bump (height) map to normal map via Sobel / gradient filters.

---

### AlbedoMapper

**File:** `js/albedoMapper.js`
**Role:** Adjust brightness, contrast, saturation of source → base‐color (albedo) map.

---

### EmissionMapper & ThreeJsEmissionMapper

**File:** `js/emissionMapper.js`
**Role:**

- **EmissionMapper:** Pixel-level algorithm implementing luminance, channel extract, color-key masks, threshold, exponent, invert, preserveAlpha.
- **ThreeJsEmissionMapper:** Canvas orchestration (blur, tint, previews), texture creation, material `emissiveMap` + `emissive` color + `emissiveIntensity`.

---

### Orchestrator (`index.js`)

**File:** `index.js`
**Role:** Glue code: scene setup, instantiation of StateManager & UI, map‐pipeline functions (`applyBumpMap`, `applyNormalMap`, …), combined `applyMaps`, resize & cleanup handlers, animation loop.

---

## Getting Started

```bash
# install dependencies
npm install

# run development server (with HMR)
npm start

# build for production
npm run build
```

---

## Usage & Workflow

1. **Open** the app in your browser (e.g. `localhost:8080`).
2. **Upload** any image via the sidebar.
3. **Choose** map type: **Bump**, **Normal**, **Albedo**, or **Emission**.
4. **Tune** parameters (sliders, dropdowns, color-pickers). Changes auto-apply (debounced).
5. **Download** the generated map as a PNG.
6. **Preview** updates live on the 3D plane in the scene.

---

## Customization & Extensibility

- **Add New Mappers:** Drop in a `[Type]Mapper.js` pair, wire through `index.js` and `userInterface.js`.
- **Theming:** Replace CSS in `styles.css` or integrate a UI library.
- **State Persistence:** Extend `StateManager` for remote sync or URL-based presets.

---

## Development & Build

- **Node.js & npm** required.
- **Webpack Dev Server** for local HMR.
- **Production Build** outputs optimized assets in `dist/`.

---

## License

MIT © 2025 **DoG Texture Studio** Contributors

```

```
