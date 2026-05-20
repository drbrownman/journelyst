// ============================================================
//  TIMELINE CONTROLLER & PLAYER ANIMATIONS
// ============================================================

function toggleTimeline() {
  const bar = document.getElementById('timeline-bar');
  const ctrl = document.getElementById('ctrl-timeline');
  bar.classList.toggle('open');
  ctrl.classList.toggle('active');
  if (bar.classList.contains('open')) {
    setupTimeline();
  } else {
    stopTimelinePlay();
  }
}

function closeTimeline() {
  document.getElementById('timeline-bar').classList.remove('open');
  document.getElementById('ctrl-timeline').classList.remove('active');
  stopTimelinePlay();
}

function setupTimeline() {
  if (!currentTrip) return;
  const slider = document.getElementById('tl-slider');
  slider.value = 0;
  timelinePos = 0;
  updateTimelineDisplay();
}

function getPositionAtTime(trip, ts) {
  // Check visits
  for (const v of trip.visits) {
    if (v.hidden) continue;
    if (ts >= v.startTime && ts <= v.endTime) {
      return { lat: v.lat, lng: v.lng };
    }
  }
  // Check paths
  for (const p of trip.paths) {
    if (p.hidden) continue;
    if (ts >= p.startTime && ts <= p.endTime) {
      const points = p.points;
      for (let i = 0; i < points.length - 1; i++) {
        const t1 = p.startTime + points[i].offsetMin * 60000;
        const t2 = p.startTime + points[i + 1].offsetMin * 60000;
        if (ts >= t1 && ts <= t2) {
          const ratio = (ts - t1) / (t2 - t1 || 1);
          const lat = points[i].lat + ratio * (points[i + 1].lat - points[i].lat);
          const lng = points[i].lng + ratio * (points[i + 1].lng - points[i].lng);
          return { lat, lng };
        }
      }
      if (points.length) {
        return { lat: points[points.length - 1].lat, lng: points[points.length - 1].lng };
      }
    }
  }
  // Check activities
  for (const a of trip.activities) {
    if (a.hidden || !a.startLat || !a.endLat) continue;
    if (ts >= a.startTime && ts <= a.endTime) {
      const ratio = (ts - a.startTime) / (a.endTime - a.startTime || 1);
      const lat = a.startLat + ratio * (a.endLat - a.startLat);
      const lng = a.startLng + ratio * (a.endLng - a.startLng);
      return { lat, lng };
    }
  }
  // Fallback to start
  if (trip.visits.length) {
    return { lat: trip.visits[0].lat, lng: trip.visits[0].lng };
  }
  return null;
}

function updateTimelineDisplay() {
  if (!currentTrip) return;
  const slider = document.getElementById('tl-slider');
  const t = timelinePos / 1000;
  const start = currentTrip.start;
  const end = currentTrip.end;
  const ts = start + t * (end - start);
  
  // Show local date/time during playback
  let localOffset = 0;
  if (currentTrip.visits.length) {
    const activeVisit = currentTrip.visits.find(v => ts >= v.startTime && ts <= v.endTime);
    if (activeVisit) {
      localOffset = activeVisit.timezoneOffset || 0;
    } else {
      localOffset = currentTrip.visits[0].timezoneOffset || 0;
    }
  }
  document.getElementById('tl-time-display').textContent = fmtLocalTime(ts, localOffset) + (localOffset >= 0 ? ` (UTC+${localOffset})` : ` (UTC${localOffset})`);

  // Show/hide markers based on time
  mapMarkers.clearLayers();
  mapPaths.clearLayers();
  mapFlights.clearLayers();

  const showMarkers = document.getElementById('tog-markers').classList.contains('on');
  const showPaths = document.getElementById('tog-paths').classList.contains('on');
  const pathColor = SETTINGS.pathColor;
  const pathWidth = SETTINGS.pathWidth;

  if (showMarkers) {
    currentTrip.visits.forEach((v, vi) => {
      if (v.hidden || v.startTime > ts) return;
      const opacity = v.endTime > ts ? 1 : 0.5;
      const defaultColor = (v.purpose === 'overnight stay' || v.purpose === 'full day') ? '#ffd166' : '#4fffb0';
      const color = v.customColor || defaultColor;
      const iconClass = (v.purpose === 'overnight stay' || v.purpose === 'full day') ? 'fa-bed' : 'fa-location-dot';
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="map-marker stop" style="background:${color};opacity:${opacity}"><i class="fa-solid ${iconClass}" style="transform:rotate(45deg);font-size:10px;color:#000"></i></div>`,
        iconSize: [28, 28], iconAnchor: [14, 28]
      });
      mapMarkers.addLayer(L.marker([v.lat, v.lng], { icon }));
    });
    
    // Add start/end markers
    if (currentTrip.visits.length) {
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
  }

  if (showPaths) {
    currentTrip.paths.forEach(path => {
      if (path.hidden) return;
      const visiblePoints = path.points.filter(p => {
        const ptTs = path.startTime + p.offsetMin * 60000;
        return ptTs <= ts;
      });
      if (visiblePoints.length >= 2) {
        mapPaths.addLayer(L.polyline(visiblePoints.map(p => [p.lat, p.lng]), {
          color: pathColor, weight: pathWidth, opacity: 0.85
        }));
      }
    });

    // Draw active/completed activities (non-flight)
    currentTrip.activities.forEach(act => {
      if (act.hidden || !act.startLat || !act.endLat || act.startTime > ts) return;
      const distKm = haversineKm(act.startLat, act.startLng, act.endLat, act.endLng);
      const mode = estimateTravelMode(act.distanceM || distKm * 1000, act.duration);
      const isFlight = mode === 'flight' || distKm > 300;
      if (isFlight) return;
      
      const opacity = act.endTime < ts ? 0.4 : 0.85;

      const hasPathOverlap = currentTrip.paths.some(path => {
        if (path.hidden) return false;
        const overlapStart = Math.max(act.startTime, path.startTime);
        const overlapEnd = Math.min(act.endTime, path.endTime);
        if (overlapEnd <= overlapStart) return false;
        const overlapDur = overlapEnd - overlapStart;
        const actDur = act.endTime - act.startTime;
        return (overlapDur / (actDur || 1)) > 0.5;
      });

      if (!hasPathOverlap) {
        mapPaths.addLayer(L.polyline([[act.startLat, act.startLng], [act.endLat, act.endLng]], {
          color: getModeColor(mode), weight: 2, dashArray: '4 4', opacity: opacity
        }));
      }
    });
  }

  // Draw flight arcs progressively — appear as timeline passes their start time
  const showFlights = document.getElementById('tog-flights') ? document.getElementById('tog-flights').classList.contains('on') : true;
  if (showFlights) {
    const flightColor = SETTINGS.flightColor || '#a0a0a0';
    const flightWidth = SETTINGS.flightWidth || 2;
    currentTrip.activities.forEach(act => {
      if (act.hidden || !act.startLat || !act.endLat || act.startTime > ts) return;
      const distKm = haversineKm(act.startLat, act.startLng, act.endLat, act.endLng);
      const mode = estimateTravelMode(act.distanceM || distKm * 1000, act.duration);
      const isFlight = mode === 'flight' || distKm > 300;
      if (!isFlight) return;

      const opacity = act.endTime < ts ? 0.5 : 0.9;
      const N = 40;
      const arcPoints = getGreatCirclePoints(act.startLat, act.startLng, act.endLat, act.endLng, N);

      // If flight is in progress, show only the portion elapsed
      let visibleArc = arcPoints;
      if (act.startTime <= ts && act.endTime > ts) {
        const ratio = (ts - act.startTime) / (act.endTime - act.startTime);
        const cutoff = Math.max(2, Math.floor(ratio * N));
        visibleArc = arcPoints.slice(0, cutoff);
      }

      if (visibleArc.length >= 2) {
        mapFlights.addLayer(L.polyline(visibleArc, {
          color: flightColor,
          weight: flightWidth,
          dashArray: '1 6',
          lineCap: 'round',
          opacity: opacity
        }));
        // Direction arrow at midpoint of visible arc
        const midIdx = Math.floor(visibleArc.length / 2);
        if (visibleArc.length > 2 && midIdx > 0) {
          const [lat1, lng1] = visibleArc[midIdx - 1];
          const [lat2, lng2] = visibleArc[Math.min(midIdx + 1, visibleArc.length - 1)];
          const angle = Math.atan2(lng2 - lng1, lat2 - lat1) * 180 / Math.PI;
          const arrowIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="transform:rotate(${angle}deg);color:${flightColor};font-size:16px;opacity:${opacity}"><i class="fa-solid fa-plane"></i></div>`,
            iconSize: [20, 20], iconAnchor: [10, 10]
          });
          mapFlights.addLayer(L.marker([visibleArc[midIdx][0], visibleArc[midIdx][1]], { icon: arrowIcon, interactive: false }));
        }
      }
    });
  }

  // Draw pulsating GPS marker
  const pos = getPositionAtTime(currentTrip, ts);
  if (pos) {
    const pulseIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="pulse-marker"></div>`,
      iconSize: [16, 16], iconAnchor: [8, 8]
    });
    mapMarkers.addLayer(L.marker([pos.lat, pos.lng], { icon: pulseIcon, zIndexOffset: 2000 }));
  }
}

function onTimelineSlider() {
  timelinePos = parseInt(document.getElementById('tl-slider').value);
  updateTimelineDisplay();
}

function seekTimeline(minutesDelta) {
  if (!currentTrip) return;
  const totalMs = currentTrip.end - currentTrip.start;
  const deltaPct = (minutesDelta * 60000) / totalMs * 1000;
  timelinePos = Math.max(0, Math.min(1000, timelinePos + deltaPct));
  document.getElementById('tl-slider').value = timelinePos;
  updateTimelineDisplay();
}

function togglePlayTimeline() {
  if (timelinePlaying) {
    stopTimelinePlay();
  } else {
    startTimelinePlay();
  }
}

function startTimelinePlay() {
  timelinePlaying = true;
  document.getElementById('tl-play-icon').className = 'fa-solid fa-pause';
  if (timelinePos >= 1000) timelinePos = 0;
  timelineTimer = setInterval(() => {
    timelinePos += 5;
    if (timelinePos > 1000) {
      timelinePos = 1000;
      stopTimelinePlay();
      return;
    }
    document.getElementById('tl-slider').value = timelinePos;
    updateTimelineDisplay();
  }, 100);
}

function stopTimelinePlay() {
  timelinePlaying = false;
  if (timelineTimer) {
    clearInterval(timelineTimer);
    timelineTimer = null;
  }
  const icon = document.getElementById('tl-play-icon');
  if (icon) icon.className = 'fa-solid fa-play';
}
