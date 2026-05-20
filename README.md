# Journelyst — Personal Travel Explorer

Journelyst is a frontend-only, premium interactive web application to visualize, explore, and share your travel history from your Google Maps Timeline exports.

It parses and clusters location visits, activities, and GPS timeline path segments into chronological trips, presenting them on a rich interactive map with timeline playbacks, flight arcs, and high-performance overview mode.

All processing occurs client-side in the browser. Your travel logs are 100% private.

---

## 🚀 Key Features

1. **Intelligent Trip Clustering**: Groups contiguous activities and visits into discrete "trips" based on customizable temporal boundaries (e.g. 48-hour gap).
2. **Beautiful Interactive Visualizations**:
   - Leaflet map rendering with dynamic multi-layer groups (routes, stops, flight arcs).
   - Animated route trails using Ant Path.
   - Customized visit markers (sizes, shapes, icons, and colors).
   - Great Circle line paths for flights and long-distance travel.
3. **Advanced Data Auditing**: Tabular explorer to view, edit, search, add, or delete individual visits, activities, or paths in the processed databases.
4. **Rich Export Formats**:
   - **HTML Embed code**: Self-contained single-file HTML showing the active trip with full interactive Leaflet visual properties.
   - **High-Res Images**: Full canvas snapshot exports using `html2canvas`.
   - **WebM Playback Video**: Renders and captures frames of the animated trip timeline playback into a downloadable video.
5. **No Build Process**: Pure vanilla Javascript, HTML5, and CSS3. Ready to run directly in any web browser without compilation.

---

## 📂 Project Structure

```
journelyst/
├── index.html                       # Application Main Entry UI
├── regions_provinces_bbox.csv       # Country and Province bounding boxes
├── css/
│   └── style.css                    # Visual styling & responsive theme design
├── js/
│   ├── state.js                     # Global state, SETTINGS, and databases
│   ├── helpers.js                   # Date formats, Haversine distance, and mode estimators
│   ├── processing.js                # Google Timeline JSON parser and trip builder
│   ├── map.js                       # Map operations, marker drawing, and tile managers
│   ├── ui.js                        # Layout tabs, modals, grid renderers, and database forms
│   ├── timeline.js                  # Playback timeline playback math & animations
│   ├── export.js                    # HTML Embeds, PNG downloads, and video captures
│   └── init.js                      # Application boots, map checks, and load calls
└── tests/
    ├── test-runner.html             # Diagnostic test suite interface
    └── tests.js                     # Test definitions & basic assertion runners
```

---

## 🛠️ How to Run Locally

1. Run `python -m http.server` (Python 3) or `python -m SimpleHTTPServer` (Python 2) in the project directory.
2. Open `http://localhost:8000`.

---

## 🗺️ How to Export Google Maps Timeline Data

1. Open the **Google Maps** app on your mobile device.
2. Tap your profile picture → **Your Timeline**.
3. Tap the three dots menu (**⋮**) in the top right → **Settings and privacy**.
4. Scroll to **Location settings** → **Export Timeline data**.
5. Choose a date range and tap **Export**.
6. Download the generated `.json` files from your email or Google Drive, then drag and drop them directly into Journelyst.
