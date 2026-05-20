// ============================================================
//  EXPORT & SHARING ENGINE (HTML, Image, WebM Video)
// ============================================================

function shareAsHTML() {
  const statusEl = document.getElementById('share-status');
  statusEl.style.display = 'block';
  statusEl.innerHTML = '<div class="spinner" style="display:inline-block;margin-right:8px;vertical-align:middle"></div>Generating HTML embed...';

  setTimeout(() => {
    try {
      const tripData = shareTarget === 'all' ? allTrips : [allTrips[shareTarget]];
      const payload = JSON.stringify({ trips: tripData, generated: new Date().toISOString() });
      const html = generateEmbedHTML(tripData, payload);
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `journelyst-${shareTarget === 'all' ? 'all-trips' : (allTrips[shareTarget]?.name?.replace(/\s+/g, '_') || 'trip')}.html`;
      a.click();
      URL.revokeObjectURL(url);
      statusEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--accent)"></i> HTML file downloaded!';
    } catch (e) {
      statusEl.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color:var(--accent2)"></i> Error: ${e.message}`;
    }
  }, 200);
}

function generateEmbedHTML(trips, payload) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Journelyst — Shared Travel Map</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    :root {
      --surface: #0d0f14;
      --surface2: #161a23;
      --surface3: #222a36;
      --border: rgba(255, 255, 255, 0.08);
      --border2: rgba(255, 255, 255, 0.12);
      --text: #e8eaf0;
      --text2: #8a93a8;
      --accent: #4fffb0;
      --shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html { height: 100%; background: var(--surface); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    #map { height: 100vh; width: 100%; }
    
    /* Info Overlay */
    .info-panel {
      position: absolute; top: 20px; left: 20px; z-index: 1000;
      background: rgba(13, 15, 20, 0.85); backdrop-filter: blur(16px);
      border: 1px solid var(--border2); border-radius: 12px;
      padding: 16px 20px; box-shadow: var(--shadow);
      max-width: 320px;
    }
    .info-panel h2 { font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
    .info-panel h2 i { color: var(--accent); }
    .info-panel p { font-size: 12px; color: var(--text2); line-height: 1.4; }
    .info-panel .meta { font-size: 11px; margin-top: 8px; color: var(--accent); font-weight: 500; }
    
    /* Leaflet Popup Styling */
    .leaflet-popup-content-wrapper {
      background: var(--surface) !important; border: 1px solid var(--border2) !important;
      border-radius: 10px !important; box-shadow: var(--shadow) !important;
      color: var(--text) !important;
    }
    .leaflet-popup-content { margin: 14px 16px !important; font-size: 13px !important; }
    .leaflet-popup-tip-container { display: none; }
    .popup-title { font-weight: 600; font-size: 14px; margin-bottom: 6px; }
    .popup-meta { font-size: 11px; color: var(--text2); margin-bottom: 4px; line-height: 1.5; }
    .popup-link { margin-top: 8px; }
    .popup-link a { font-size: 11px; color: var(--accent); text-decoration: none; }
    
    /* Marker Styling */
    .custom-div-icon { background: none !important; border: none !important; }
    .map-marker {
      width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg); display: flex; align-items: center; justify-content: center;
      border: 2px solid rgba(0,0,0,0.3); box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    }
    .map-marker i { transform: rotate(45deg); font-size: 12px; color: #000; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="info-panel">
    <h2><i class="fa-solid fa-compass"></i> Journelyst</h2>
    <p>Shared travel visualization showing your paths, stops, and travel activities.</p>
    <div class="meta">${trips.length} trip${trips.length !== 1 ? 's' : ''} · Generated ${new Date().toLocaleDateString()}</div>
  </div>

  <script>
    // Embedded Data
    const data = ${payload};
    const activeBasemap = ${JSON.stringify(BASEMAPS[currentBasemap])};
    const settings = {
      pathColor: '${SETTINGS.pathColor}',
      pathWidth: ${SETTINGS.pathWidth},
      flightColor: '${SETTINGS.flightColor || '#a0a0a0'}',
      flightWidth: ${SETTINGS.flightWidth || 2},
      markerColor: '${SETTINGS.markerColor || '#4fffb0'}',
      markerIcon: '${SETTINGS.markerIcon || 'fa-location-dot'}',
      markerSize: '${SETTINGS.markerSize || 'medium'}'
    };

    // Helper functions
    function fmtDateTime(ts) {
      if (!ts) return '--';
      return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function fmtLocalTime(ts, offsetHours) {
      if (!ts) return '--';
      const localDate = new Date(ts + offsetHours * 3600000);
      const pad = (n) => String(n).padStart(2, '0');
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const month = months[localDate.getUTCMonth()];
      const day = localDate.getUTCDate();
      const year = localDate.getUTCFullYear();
      let hours = localDate.getUTCHours();
      const minutes = pad(localDate.getUTCMinutes());
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return \`\${month} \${day}, \${year} \${hours}:\${minutes} \${ampm}\`;
    }

    function fmtDuration(ms) {
      if (!ms) return '--';
      const mins = Math.round(ms / 60000);
      if (mins < 60) return \`\${mins} min\`;
      const hrs = Math.floor(mins / 60);
      const rem = mins % 60;
      return rem ? \`\${hrs} hr \${rem} min\` : \`\${hrs} hr\`;
    }

    function haversineKm(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    function getGreatCirclePoints(lat1, lng1, lat2, lng2, N = 40) {
      const toRad = Math.PI / 180;
      const toDeg = 180 / Math.PI;
      const phi1 = lat1 * toRad, lambda1 = lng1 * toRad;
      const phi2 = lat2 * toRad, lambda2 = lng2 * toRad;
      const sinDPhi = Math.sin((phi2 - phi1) / 2);
      const sinDLambda = Math.sin((lambda2 - lambda1) / 2);
      const a = sinDPhi * sinDPhi + Math.cos(phi1) * Math.cos(phi2) * sinDLambda * sinDLambda;
      const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (d < 0.000001) return [[lat1, lng1]];
      const points = [];
      for (let i = 0; i <= N; i++) {
        const f = i / N;
        const A = Math.sin((1 - f) * d) / Math.sin(d);
        const B = Math.sin(f * d) / Math.sin(d);
        const x = A * Math.cos(phi1) * Math.cos(lambda1) + B * Math.cos(phi2) * Math.cos(lambda2);
        const y = A * Math.cos(phi1) * Math.sin(lambda1) + B * Math.cos(phi2) * Math.sin(lambda2);
        const z = A * Math.sin(phi1) + B * Math.sin(phi2);
        const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * toDeg;
        let lng = Math.atan2(y, x) * toDeg;
        points.push([lat, lng]);
      }
      for (let i = 1; i < points.length; i++) {
        const prevLng = points[i-1][1];
        let currLng = points[i][1];
        if (currLng - prevLng > 180) currLng -= 360;
        else if (currLng - prevLng < -180) currLng += 360;
        points[i][1] = currLng;
      }
      return points;
    }

    function estimateTravelMode(distanceM, durationMs) {
      const speedKmh = (distanceM / 1000) / (durationMs / 3600000);
      if (speedKmh > 200) return 'flight';
      if (speedKmh > 80) return 'train';
      if (speedKmh > 20) return 'car';
      if (speedKmh > 8) return 'bike';
      return 'walking';
    }

    // Initialize Map with saved/selected Tile Layer
    const map = L.map('map', { center: [20, 0], zoom: 2, attributionControl: true });
    L.tileLayer(activeBasemap.url, { attribution: activeBasemap.attr, maxZoom: 19 }).addTo(map);

    const mapPaths = L.layerGroup().addTo(map);
    const mapFlights = L.layerGroup().addTo(map);
    const mapMarkers = L.layerGroup().addTo(map);

    // Dynamic rendering utilizing the same rendering function
    function renderTripDataOnMap(trip, targetMap, pathsGroup, flightsGroup, markersGroup, config) {
      const showPaths = config.showPaths;
      const showMarkers = config.showMarkers;
      const showFlights = config.showFlights;
      const pathColor = config.pathColor;
      const pathWidth = config.pathWidth;
      const flightColor = config.flightColor;
      const flightWidth = config.flightWidth;
      const opacityMultiplier = config.opacityMultiplier !== undefined ? config.opacityMultiplier : 1.0;
      const interactive = config.interactive !== undefined ? config.interactive : true;

      // Draw paths
      if (showPaths && trip.paths) {
        trip.paths.forEach(path => {
          if (path.hidden || path.points.length < 5) return;
          if (config.pruneForOverview) {
            const firstPt = path.points[0];
            const lastPt = path.points[path.points.length - 1];
            const dist = haversineKm(firstPt.lat, firstPt.lng, lastPt.lat, lastPt.lng);
            if (dist < 50.0) return; // skip short distance path
          }
          const latlngs = path.points.map(p => [p.lat, p.lng]);
          const polyline = L.polyline(latlngs, { color: pathColor, weight: pathWidth, opacity: 0.85 * opacityMultiplier });
          if (interactive) {
            polyline.on('click', () => {
              const dur = fmtDuration(path.endTime - path.startTime);
              L.popup().setLatLng(latlngs[Math.floor(latlngs.length/2)]).setContent(\`
                <div class="popup-title"><i class="fa-solid fa-route"></i> Route Path</div>
                <div class="popup-meta">\${fmtDateTime(path.startTime)} → \${fmtDateTime(path.endTime)}</div>
                <div class="popup-meta">Duration: \${dur} · \${path.points.length} points</div>
              \`).openOn(targetMap);
            });
          }
          pathsGroup.addLayer(polyline);
        });
      }

      // Draw activities
      if (trip.activities) {
        trip.activities.forEach(act => {
          if (act.hidden || !act.startLat || !act.endLat) return;
          const distKm = haversineKm(act.startLat, act.startLng, act.endLat, act.endLng);
          const mode = estimateTravelMode(act.distanceM || distKm*1000, act.duration);

          const isFlight = mode === 'flight' || distKm > 300;
          if (isFlight && showFlights) {
            const N = 40;
            const arcPoints = getGreatCirclePoints(act.startLat, act.startLng, act.endLat, act.endLng, N);
            const arc = L.polyline(arcPoints, {
              color: flightColor || '#a0a0a0',
              weight: flightWidth || 2,
              dashArray: '1 6',
              lineCap: 'round',
              opacity: 0.85 * opacityMultiplier
            });
            if (interactive) {
              arc.on('click', () => {
                L.popup().setLatLng(arcPoints[Math.floor(N/2)]).setContent(\`
                  <div class="popup-title"><i class="fa-solid fa-plane"></i> Flight / Long Distance</div>
                  <div class="popup-meta">Distance: \${Math.round(distKm)} km</div>
                  <div class="popup-meta">\${fmtDateTime(act.startTime)} → \${fmtDateTime(act.endTime)}</div>
                  <div class="popup-meta">Duration: \${fmtDuration(act.duration)}</div>
                \`).openOn(targetMap);
              });
            }
            flightsGroup.addLayer(arc);

            const midIdx = Math.floor(N/2);
            if (arcPoints.length > midIdx + 1) {
              const [lat1, lng1] = arcPoints[midIdx - 1];
              const [lat2, lng2] = arcPoints[midIdx + 1];
              const angle = Math.atan2(lng2 - lng1, lat2 - lat1) * 180 / Math.PI;
              const arrowIcon = L.divIcon({
                className: 'custom-div-icon',
                html: \`<div style="transform:rotate(\${angle}deg);color:\${flightColor || '#a0a0a0'};font-size:16px;opacity:\${opacityMultiplier}"><i class="fa-solid fa-plane"></i></div>\`,
                iconSize: [20, 20], iconAnchor: [10, 10]
              });
              flightsGroup.addLayer(L.marker([arcPoints[midIdx][0], arcPoints[midIdx][1]], { icon: arrowIcon, interactive: false }));
            }
          } else if (!isFlight && showPaths) {
            if (config.pruneForOverview) return; // prune non-flight activities
            const hasPathOverlap = (trip.paths || []).some(path => {
              if (path.hidden) return false;
              const overlapStart = Math.max(act.startTime, path.startTime);
              const overlapEnd = Math.min(act.endTime, path.endTime);
              if (overlapEnd <= overlapStart) return false;
              const overlapDur = overlapEnd - overlapStart;
              const actDur = act.endTime - act.startTime;
              return (overlapDur / (actDur || 1)) > 0.5;
            });

            if (!hasPathOverlap) {
              const line = L.polyline([[act.startLat, act.startLng], [act.endLat, act.endLng]], {
                color: getModeColor(act.mode || mode), weight: 2, dashArray: '4 4', opacity: 0.7 * opacityMultiplier
              });
              if (interactive) {
                line.on('click', () => {
                  L.popup().setLatLng([(act.startLat+act.endLat)/2, (act.startLng+act.endLng)/2]).setContent(\`
                    <div class="popup-title"><i class="fa-solid \${getModeIcon(act.mode || mode)}"></i> \${act.mode || mode}</div>
                    <div class="popup-meta">Distance: \${Math.round(distKm*10)/10} km</div>
                    <div class="popup-meta">\${fmtDateTime(act.startTime)} → \${fmtDateTime(act.endTime)}</div>
                  \`).openOn(targetMap);
                });
              }
              pathsGroup.addLayer(line);
            }
          }
        });
      }

      // Draw visit markers
      if (showMarkers && trip.visits) {
        trip.visits.forEach(visit => {
          if (visit.hidden) return;
          if (config.pruneForOverview && config.renderedCoords) {
            const isTooClose = config.renderedCoords.some(coord => {
              return haversineKm(visit.lat, visit.lng, coord.lat, coord.lng) < 2.0;
            });
            if (isTooClose) return;
            config.renderedCoords.push({ lat: visit.lat, lng: visit.lng });
          }
          const isOvernightOrFull = visit.purpose === 'overnight stay' || visit.purpose === 'full day';
          const defaultColor = isOvernightOrFull ? '#ffd166' : (settings.markerColor || '#4fffb0');
          const color = visit.customColor || defaultColor;
          const customIconClass = visit.customIcon || (isOvernightOrFull ? 'fa-bed' : (settings.markerIcon || 'fa-location-dot'));

          let size = 28;
          let iconSize = 10;
          if (settings.markerSize === 'small') { size = 20; iconSize = 8; }
          else if (settings.markerSize === 'medium-small') { size = 24; iconSize = 9; }
          else if (settings.markerSize === 'medium') { size = 28; iconSize = 10; }
          else if (settings.markerSize === 'large') { size = 34; iconSize = 12; }
          else if (settings.markerSize === 'extra-large') { size = 40; iconSize = 14; }

          const icon = L.divIcon({
            className: 'custom-div-icon',
            html: \`<div class="map-marker stop" style="background:\${color};opacity:\${opacityMultiplier};width:\${size}px;height:\${size}px;border-radius:50% 50% 50% 0;"><i class="fa-solid \${customIconClass}" style="transform:rotate(45deg);font-size:\${iconSize}px;color:#000"></i></div>\`,
            iconSize: [size, size], iconAnchor: [size / 2, size], popupAnchor: [0, -size - 2]
          });

          const marker = L.marker([visit.lat, visit.lng], { icon, interactive });
          if (interactive) {
            const gmapsUrl = \`https://www.google.com/maps?q=\${visit.lat},\${visit.lng}\`;
            const gmapsDeepLink = \`comgooglemaps://?q=\${visit.lat},\${visit.lng}\`;
            marker.bindPopup(\`
              <div class="popup-title"><i class="fa-solid fa-location-dot"></i> \${visit.semanticType || 'Visit'}</div>
              <div class="popup-meta">📍 \${visit.region || 'Unknown location'}</div>
              <div class="popup-meta">🕐 \${fmtLocalTime(visit.startTime, visit.timezoneOffset || 0)} (Local)</div>
              <div class="popup-meta">⏱ \${fmtDuration(visit.duration)} · \${visit.purpose}</div>
              <div class="popup-meta">🌅 \${visit.timeOfDay}</div>
              <div class="popup-link">
                <a href="\${gmapsUrl}" target="_blank"><i class="fa-solid fa-map-location-dot"></i> Open in Google Maps</a>
                &nbsp;·&nbsp;
                <a href="\${gmapsDeepLink}"><i class="fa-brands fa-google"></i> App</a>
              </div>
            \`);
          }
          markersGroup.addLayer(marker);
        });
      }
    }

    const bounds = [];
    const renderedCoords = [];
    data.trips.forEach(trip => {
      if (trip.bbox) {
        bounds.push([trip.bbox.south, trip.bbox.west], [trip.bbox.north, trip.bbox.east]);
      }
      renderTripDataOnMap(trip, map, mapPaths, mapFlights, mapMarkers, {
        showPaths: true,
        showMarkers: data.trips.length === 1,
        showFlights: true,
        pathColor: settings.pathColor,
        pathWidth: settings.pathWidth,
        flightColor: settings.flightColor,
        flightWidth: settings.flightWidth,
        opacityMultiplier: 1.0,
        interactive: true,
        pruneForOverview: data.trips.length > 1,
        renderedCoords: renderedCoords
      });
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  <\/script>
</body>
</html>`;
}

function shareAsImage() {
  const statusEl = document.getElementById('share-status');
  statusEl.style.display = 'block';
  statusEl.innerHTML = '<div class="spinner" style="display:inline-block;margin-right:8px;vertical-align:middle"></div>Capturing map image...';

  // Hide Leaflet control buttons temporarily to get a clean export
  const controls = document.querySelectorAll('.leaflet-control-container');
  controls.forEach(c => c.style.display = 'none');

  setTimeout(() => {
    html2canvas(document.getElementById('map'), {
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#0d0f14',
      logging: false
    }).then(canvas => {
      // Restore controls
      controls.forEach(c => c.style.display = '');
      
      try {
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `journelyst-${shareTarget === 'all' ? 'all-trips' : (allTrips[shareTarget]?.name?.replace(/\s+/g, '_') || 'trip')}.png`;
        a.click();
        statusEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--accent)"></i> Image downloaded successfully!';
      } catch (err) {
        statusEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="color:var(--accent2)"></i> Canvas export failed due to security restrictions. Try using your browser\'s built-in screenshot utility.';
      }
    }).catch(err => {
      controls.forEach(c => c.style.display = '');
      statusEl.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color:var(--accent2)"></i> Error: ${err.message}`;
    });
  }, 500);
}

function shareAsVideo() {
  if (!currentTrip) {
    showToast('Please select and open a trip to export its playback video', 'warning');
    return;
  }
  
  const statusEl = document.getElementById('share-status');
  statusEl.style.display = 'block';
  statusEl.innerHTML = '<div class="spinner" style="display:inline-block;margin-right:8px;vertical-align:middle"></div>Initializing video recorder...';
  
  // Stop existing playback
  stopTimelinePlay();
  
  const mapEl = document.getElementById('map');
  const width = mapEl.clientWidth;
  const height = mapEl.clientHeight;
  
  const recordCanvas = document.createElement('canvas');
  recordCanvas.width = width;
  recordCanvas.height = height;
  const ctx = recordCanvas.getContext('2d');
  
  let stream;
  try {
    stream = recordCanvas.captureStream(10); // 10 fps recording
  } catch (err) {
    statusEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="color:var(--accent2)"></i> Video capture is not supported by your browser.';
    return;
  }
  
  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
  recorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journelyst-${currentTrip.name.replace(/\s+/g, '_')}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    statusEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--accent)"></i> Video download started!';
  };
  
  // Hide map controls temporarily
  const controls = document.querySelectorAll('.leaflet-control-container');
  controls.forEach(c => c.style.display = 'none');
  
  // Start recording
  recorder.start();
  
  let frame = 0;
  const totalFrames = 30; // 30 steps is perfect for a short high-quality clip
  timelinePos = 0;
  
  function captureNextFrame() {
    if (frame >= totalFrames) {
      setTimeout(() => {
        recorder.stop();
        controls.forEach(c => c.style.display = '');
      }, 500);
      return;
    }
    
    // Set position and update map
    timelinePos = Math.round((frame / (totalFrames - 1)) * 1000);
    document.getElementById('tl-slider').value = timelinePos;
    updateTimelineDisplay();
    
    statusEl.innerHTML = `<div class="spinner" style="display:inline-block;margin-right:8px;vertical-align:middle"></div>Recording frame ${frame + 1}/${totalFrames}...`;
    
    // Wait slightly for map/markers to render
    setTimeout(() => {
      html2canvas(mapEl, {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#0d0f14',
        logging: false,
        width: width,
        height: height
      }).then(canvas => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(canvas, 0, 0, width, height);
        
        frame++;
        captureNextFrame();
      }).catch(err => {
        recorder.stop();
        controls.forEach(c => c.style.display = '');
        statusEl.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="color:var(--accent2)"></i> Error capturing frame: ${err.message}`;
      });
    }, 150); // 150ms buffer to draw Leaflet markers
  }
  
  // Start frame capturing sequence
  captureNextFrame();
}
