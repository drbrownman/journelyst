// ============================================================
//  MAP RENDERING ENGINE & LEAFLET MANAGEMENT
// ============================================================

function initMap() {
  map = L.map('map', {
    center: [20, 0], zoom: 2,
    minZoom: 2,
    zoomControl: false,
    attributionControl: true,
    preferCanvas: true
  });

  mapMarkers = L.layerGroup().addTo(map);
  mapPaths = L.layerGroup().addTo(map);
  mapFlights = L.layerGroup().addTo(map);

  setBasemap(0);

  // Render basemap picker
  const bmList = document.getElementById('basemap-list');
  if (bmList) {
    bmList.innerHTML = '';
    BASEMAPS.forEach((bm, i) => {
      const el = document.createElement('div');
      el.className = 'basemap-option' + (i === 0 ? ' active' : '');
      el.innerHTML = `<div class="basemap-swatch" style="background:${bm.color}"></div>${bm.name}`;
      el.onclick = () => { setBasemap(i); toggleBasemapPicker(); };
      bmList.appendChild(el);
    });
  }

  // Close basemap picker on map click
  map.on('click', () => {
    document.getElementById('basemap-picker').classList.remove('open');
    document.getElementById('ctrl-basemap').classList.remove('active');
  });

  // Re-apply filters if map bounds change and checkbox is ticked
  map.on('moveend', () => {
    const checkbox = document.getElementById('filter-viewport');
    if (checkbox && checkbox.checked) {
      applyFilters();
    }
  });

  // Verify tiles loading status
  setTimeout(() => {
    if (!map.getContainer().querySelector('.leaflet-tile-loaded')) {
      showToast('Map tiles may not be loading. Check your internet connection.', 'warning');
    }
  }, 5000);
}

function setBasemap(idx) {
  idx = parseInt(idx, 10);
  currentBasemap = idx;
  if (tileLayer) map.removeLayer(tileLayer);
  const bm = BASEMAPS[idx];
  tileLayer = L.tileLayer(bm.url, { attribution: bm.attr, maxZoom: 19 });
  tileLayer.addTo(map);
  document.querySelectorAll('.basemap-option').forEach((el, i) => el.classList.toggle('active', i === idx));
}

// Apply the appropriate basemap for overview vs. trip view
function applyBasemapForContext() {
  if (currentTrip && currentTrip.style && currentTrip.style.basemap !== undefined) {
    if (currentTrip.style.basemap !== currentBasemap) setBasemap(currentTrip.style.basemap);
  } else if (!currentTrip) {
    if (overviewBasemap !== currentBasemap) setBasemap(overviewBasemap);
  }
}

// Helper: get effective style value for current trip (trip.style overrides SETTINGS)
function getTripStyle(key, fallback) {
  if (currentTrip && currentTrip.style && currentTrip.style[key] !== undefined) {
    return currentTrip.style[key];
  }
  return (SETTINGS[key] !== undefined ? SETTINGS[key] : fallback);
}

function clearMapLayers() {
  if (typeof map !== 'undefined' && map) {
    map.closePopup();
  }
  mapMarkers.clearLayers();
  mapPaths.clearLayers();
  mapFlights.clearLayers();
}

function getCombinedBounds() {
  const lats = [], lngs = [];
  allTrips.forEach(t => {
    if (t.bbox) {
      lats.push(t.bbox.south, t.bbox.north);
      lngs.push(t.bbox.west, t.bbox.east);
    }
  });
  if (!lats.length) return null;
  return {
    south: Math.min(...lats), north: Math.max(...lats),
    west: Math.min(...lngs), east: Math.max(...lngs)
  };
}

function fitMapToTrip(trip) {
  const bbox = getTripZoomBounds(trip) || trip.bbox;
  if (!bbox) {
    map.setView([20, 0], 2);
    return;
  }
  const { south, north, west, east } = bbox;
  const pad = Math.max((north - south) * 0.2, (east - west) * 0.2, 0.05);
  try {
    map.fitBounds([[south - pad, west - pad], [north + pad, east + pad]], { animate: true });
  } catch (e) {
    map.setView([20, 0], 2);
  }
}

function renderTripDataOnMap(trip, targetMap, pathsGroup, flightsGroup, markersGroup, config) {
  const showPaths = config.showPaths;
  const showMarkers = config.showMarkers;
  const showFlights = config.showFlights;
  const animate = config.animate;
  const pathColor = config.pathColor;
  const pathWidth = config.pathWidth;
  const flightColor = config.flightColor;
  const flightWidth = config.flightWidth;
  const opacityMultiplier = config.opacityMultiplier !== undefined ? config.opacityMultiplier : 1.0;
  const interactive = config.interactive !== undefined ? config.interactive : true;
  const showActions = config.showActions !== undefined ? config.showActions : false;

  // Draw paths
  if (showPaths && trip.paths) {
    trip.paths.forEach((path, pi) => {
      if (path.hidden || path.points.length < 5) return;
      if (config.pruneForOverview) {
        const firstPt = path.points[0];
        const lastPt = path.points[path.points.length - 1];
        const dist = haversineKm(firstPt.lat, firstPt.lng, lastPt.lat, lastPt.lng);
        if (dist < 50.0) return; // skip short distance path
      }
      const latlngs = path.points.map(p => [p.lat, p.lng]);
      let polyline;
      if (animate && window.L.polyline.antPath) {
        polyline = L.polyline.antPath(latlngs, {
          color: pathColor,
          weight: pathWidth,
          opacity: 0.85 * opacityMultiplier,
          delay: 2000,
          dashArray: [10, 20],
          pulseColor: '#fff'
        });
      } else {
        polyline = L.polyline(latlngs, { color: pathColor, weight: pathWidth, opacity: 0.85 * opacityMultiplier });
      }
      if (interactive) {
        polyline.on('click', () => {
          const dur = fmtDuration(path.endTime - path.startTime);
          let popupHtml = `
            <div class="popup-title"><i class="fa-solid fa-route"></i> Route Path</div>
            <div class="popup-meta">${fmtDateTime(path.startTime)} → ${fmtDateTime(path.endTime)}</div>
            <div class="popup-meta">Duration: ${dur} · ${path.points.length} points</div>
          `;
          if (showActions) {
            popupHtml += `<div class="popup-meta"><button class="btn sm ghost" onclick="hidePath(${pi})">Hide</button></div>`;
          }
          L.popup().setLatLng(latlngs[Math.floor(latlngs.length / 2)]).setContent(popupHtml).openOn(targetMap);
        });
      }
      pathsGroup.addLayer(polyline);
    });
  }

  // Draw activities
  if (trip.activities) {
    trip.activities.forEach((act, ai) => {
      if (act.hidden || !act.startLat || !act.endLat) return;
      const distKm = haversineKm(act.startLat, act.startLng, act.endLat, act.endLng);
      const mode = estimateTravelMode(act.distanceM || distKm * 1000, act.duration);

      const isFlight = mode === 'flight' || distKm > 300;
      if (isFlight && showFlights) {
        // Draw Great Circle arc
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
            let popupHtml = `
              <div class="popup-title"><i class="fa-solid fa-plane"></i> Flight / Long Distance</div>
              <div class="popup-meta">Distance: ${Math.round(distKm)} km</div>
              <div class="popup-meta">${fmtDateTime(act.startTime)} → ${fmtDateTime(act.endTime)}</div>
              <div class="popup-meta">Duration: ${fmtDuration(act.duration)}</div>
            `;
            if (showActions) {
              popupHtml += `<div class="popup-meta"><button class="btn sm ghost" onclick="hideActivity(${ai})">Hide</button></div>`;
            }
            L.popup().setLatLng(arcPoints[Math.floor(N / 2)]).setContent(popupHtml).openOn(targetMap);
          });
        }
        flightsGroup.addLayer(arc);

        // Direction arrow
        const midIdx = Math.floor(N / 2);
        if (arcPoints.length > midIdx + 1) {
          const [lat1, lng1] = arcPoints[midIdx - 1];
          const [lat2, lng2] = arcPoints[midIdx + 1];
          const angle = Math.atan2(lng2 - lng1, lat2 - lat1) * 180 / Math.PI;
          const arrowIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="transform:rotate(${angle}deg);color:${flightColor || '#a0a0a0'};font-size:16px;opacity:${opacityMultiplier}"><i class="fa-solid fa-plane"></i></div>`,
            iconSize: [20, 20], iconAnchor: [10, 10]
          });
          flightsGroup.addLayer(L.marker([arcPoints[midIdx][0], arcPoints[midIdx][1]], { icon: arrowIcon, interactive: false }));
        }
      } else if (!isFlight && showPaths) {
        if (config.pruneForOverview) return; // prune non-flight activities in overview mode
        // Check if this activity overlaps significantly with any path segment
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
              L.popup().setLatLng([(act.startLat + act.endLat) / 2, (act.startLng + act.endLng) / 2]).setContent(`
                <div class="popup-title"><i class="fa-solid ${getModeIcon(act.mode || mode)}"></i> ${act.mode || mode}</div>
                <div class="popup-meta">Distance: ${Math.round(distKm * 10) / 10} km</div>
                <div class="popup-meta">${fmtDateTime(act.startTime)} → ${fmtDateTime(act.endTime)}</div>
              `).openOn(targetMap);
            });
          }
          pathsGroup.addLayer(line);
        }
      }
    });
  }

  // Draw visit markers
  if (showMarkers && trip.visits) {
    trip.visits.forEach((visit, vi) => {
      if (visit.hidden) return;
      if (config.pruneForOverview && config.renderedCoords) {
        const isTooClose = config.renderedCoords.some(coord => {
          return haversineKm(visit.lat, visit.lng, coord.lat, coord.lng) < 2.0;
        });
        if (isTooClose) return;
        config.renderedCoords.push({ lat: visit.lat, lng: visit.lng });
      }
      const isOvernightOrFull = visit.purpose === 'overnight stay' || visit.purpose === 'full day';
      const mColor = config.markerColor || SETTINGS.markerColor || '#4fffb0';
      const mIcon  = config.markerIcon  || SETTINGS.markerIcon  || 'fa-location-dot';
      const mSize  = config.markerSize  || SETTINGS.markerSize  || 'medium';
      const defaultColor = isOvernightOrFull ? '#ffd166' : mColor;
      const color = visit.customColor || defaultColor;
      const customIconClass = visit.customIcon || (isOvernightOrFull ? 'fa-bed' : mIcon);

      let size = 28;
      let iconSize = 10;
      if (mSize === 'small') { size = 20; iconSize = 8; }
      else if (mSize === 'medium-small') { size = 24; iconSize = 9; }
      else if (mSize === 'medium') { size = 28; iconSize = 10; }
      else if (mSize === 'large') { size = 34; iconSize = 12; }
      else if (mSize === 'extra-large') { size = 40; iconSize = 14; }

      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="map-marker stop" style="background:${color};opacity:${opacityMultiplier};width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;"><i class="fa-solid ${customIconClass}" style="transform:rotate(45deg);font-size:${iconSize}px;color:#000"></i></div>`,
        iconSize: [size, size], iconAnchor: [size / 2, size], popupAnchor: [0, -size - 2]
      });

      const marker = L.marker([visit.lat, visit.lng], { icon, interactive });
      if (interactive) {
        const gmapsUrl = `https://www.google.com/maps?q=${visit.lat},${visit.lng}`;
        const gmapsDeepLink = `comgooglemaps://?q=${visit.lat},${visit.lng}`;
        let popupHtml = `
          <div class="popup-title"><i class="fa-solid fa-location-dot"></i> ${visit.semanticType || 'Visit'}</div>
          <div class="popup-meta">📍 ${visit.region || 'Unknown location'}</div>
          <div class="popup-meta">🕐 ${fmtLocalTime(visit.startTime, visit.timezoneOffset || 0)} (Local)</div>
          <div class="popup-meta">⏱ ${fmtDuration(visit.duration)} · ${visit.purpose}</div>
          <div class="popup-meta">🌅 ${visit.timeOfDay}</div>
          <div class="popup-link">
            <a href="${gmapsUrl}" target="_blank"><i class="fa-solid fa-map-location-dot"></i> Open in Google Maps</a>
            &nbsp;·&nbsp;
            <a href="${gmapsDeepLink}"><i class="fa-brands fa-google"></i> App</a>
          </div>
        `;
        if (showActions) {
          popupHtml += `
            <div class="popup-meta" style="margin-top:6px;display:flex;gap:6px;">
              <button class="btn sm accent" onclick="editVisitInline(${vi})"><i class="fa-solid fa-pen"></i> Edit</button>
              <button class="btn sm ghost" onclick="hideVisit(${vi})"><i class="fa-solid fa-eye-slash"></i> Hide</button>
            </div>
          `;
        }
        marker.bindPopup(popupHtml);
      }
      markersGroup.addLayer(marker);
    });
  }
}

function renderCurrentTrip() {
  clearMapLayers();
  applyBasemapForContext();
  
  if (currentTrip) {
    // Render active trip in full color using per-trip style (falls back to SETTINGS)
    renderTripDataOnMap(currentTrip, map, mapPaths, mapFlights, mapMarkers, {
      showPaths: document.getElementById('tog-paths').classList.contains('on'),
      showMarkers: document.getElementById('tog-markers').classList.contains('on'),
      showFlights: document.getElementById('tog-flights').classList.contains('on'),
      animate: document.getElementById('tog-animate').classList.contains('on'),
      pathColor: getTripStyle('pathColor', '#4fffb0'),
      pathWidth: getTripStyle('pathWidth', 5),
      flightColor: getTripStyle('flightColor', '#a0a0a0'),
      flightWidth: getTripStyle('flightWidth', 2),
      markerColor: getTripStyle('markerColor', '#4fffb0'),
      markerIcon: getTripStyle('markerIcon', 'fa-location-dot'),
      markerSize: getTripStyle('markerSize', 'medium'),
      opacityMultiplier: 1.0,
      interactive: true,
      showActions: true,
      pruneForOverview: false
    });

    // Add start/end markers
    const showMarkers = document.getElementById('tog-markers').classList.contains('on');
    if (showMarkers && currentTrip.visits.length) {
      const first = currentTrip.visits[0];
      const last = currentTrip.visits[currentTrip.visits.length - 1];
      const startIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background:#fff;border:3px solid #4fffb0;width:14px;height:14px;border-radius:50%;box-shadow:0 0 8px #4fffb0"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7]
      });
      const endIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background:#ff6b6b;border:3px solid #fff;width:14px;height:14px;border-radius:50%;box-shadow:0 0 8px #ff6b6b"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7]
      });
      mapMarkers.addLayer(L.marker([first.lat, first.lng], { icon: startIcon, zIndexOffset: 1000 })
        .bindTooltip('Start', { permanent: false }));
      if (last !== first) {
        mapMarkers.addLayer(L.marker([last.lat, last.lng], { icon: endIcon, zIndexOffset: 1000 })
          .bindTooltip('End', { permanent: false }));
      }
    }
  } else {
    // No active trip: Render all trips in full color
    const renderedCoords = [];
    allTrips.forEach(trip => {
      renderTripDataOnMap(trip, map, mapPaths, mapFlights, mapMarkers, {
        showPaths: true,
        showMarkers: false,
        showFlights: true,
        animate: false,
        pathColor: SETTINGS.pathColor,
        pathWidth: SETTINGS.pathWidth,
        flightColor: SETTINGS.flightColor || '#a0a0a0',
        flightWidth: SETTINGS.flightWidth || 2,
        opacityMultiplier: 0.8,
        interactive: true,
        showActions: false,
        pruneForOverview: true,
        renderedCoords: renderedCoords
      });
    });

    // Fit map bounds to show all trips concatenated
    const bounds = getCombinedBounds();
    if (bounds) {
      const pad = Math.max((bounds.north - bounds.south) * 0.15, (bounds.east - bounds.west) * 0.15, 0.05);
      try {
        map.fitBounds([[bounds.south - pad, bounds.west - pad], [bounds.north + pad, bounds.east + pad]], { animate: true });
      } catch (e) {
        map.setView([20, 0], 2);
      }
    }
  }
}

function hideVisit(vi) {
  if (currentTrip) {
    currentTrip.visits[vi].hidden = true;
    renderCurrentTrip();
    map.closePopup();
  }
}

function hideActivity(ai) {
  if (currentTrip) {
    currentTrip.activities[ai].hidden = true;
    renderCurrentTrip();
    map.closePopup();
  }
}

function hidePath(pi) {
  if (currentTrip) {
    currentTrip.paths[pi].hidden = true;
    renderCurrentTrip();
    map.closePopup();
  }
}
