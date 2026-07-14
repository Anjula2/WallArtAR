# WallArt AR Studio Configurator

A premium web-based 3D configurator and AR visualization tool for wall art. This application is built with HTML5, vanilla CSS, and Three.js (WebGL) to offer high-fidelity interactive previews of frames, canvases, posters, and metal prints.

## Features

- **Realistic 3D Preview**: Renders custom aspect ratios, realistic lighting, and wall textures.
- **Multiple Wall Art Styles**:
  - **Modern Frame**: Customizable wooden/metallic finishes (Matte Black, Oak, Gold, White), border widths, and mat board offsets with a reflective glass layer.
  - **Canvas Wrap**: Realistic canvas profile depth and photo wrapping options.
  - **Metal Print**: High-gloss, high-reflective aluminum panel floating 1.5 cm off the wall casting real floating shadows.
  - **Poster**: Dynamic curled paper simulation using 3D vertex displacements to mimic natural print textures.
- **Interactive Camera Control**: Smooth camera animations to view from the Front, Left Oblique, Right Oblique, Overhead, or manual orbit zoom.
- **Dynamic Lighting Options**: Switch between Studio Spotlight, Cozy Golden Hour, or Bright Daylight.
- **AR Camera Simulation Mode**: Visualizes the custom wall art on your actual wall by overlaying the 3D model onto your device's live camera feed. Includes intuitive drag and pinch-to-scale touch support.
- **Custom Image Upload**: Drag & drop or file upload support.

## Getting Started

To run the application, open the project directory in a local web server (e.g., VS Code Live Server, Python's HTTP server, or Node's `http-server`) to allow loading assets and Three.js modules correctly:

### Quick Start using Python:
Run the following command in the workspace directory:
```bash
python -m http.server 8000
```
Then navigate to: `http://localhost:8000` in your web browser.

### Quick Start using Node:
```bash
npx http-server ./ -p 8000
```
Then navigate to: `http://localhost:8000` in your browser.

## Interaction Guide

- **Rotate Camera (3D View)**: Left-click and drag anywhere on the canvas.
- **Pan Camera (3D View)**: Right-click and drag.
- **Zoom**: Scroll your mouse wheel or pinch on a trackpad.
- **Position Artwork in AR**: Tap/click and drag the artwork in the video frame.
- **Resize Artwork in AR**: Use pinch gestures with two fingers.
