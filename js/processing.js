// ============================================================
//  DATA PROCESSING, TIMELINE PARSING, & TRIP BUILDING
// ============================================================

async function loadRegionsCSV() {
  try {
    const response = await fetch('regions_provinces_bbox.csv');
    if (!response.ok) throw new Error('Failed to fetch file');
    const text = await response.text();
    parseRegionsCSV(text);
    console.log(`Loaded ${REGIONS.length} regions from CSV.`);
  } catch (err) {
    console.warn("Could not load regions CSV, using built-in simplified regions.", err);
  }
}

function parseRegionsCSV(text) {
  const lines = text.split(/\r?\n/);
  const parsed = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const match = line.match(/^([^,]+),([^,]*),"(.*)"$/) || line.match(/^([^,]+),([^,]*),(.*)$/);
    if (!match) continue;
    const country = match[1];
    const region = match[2];
    const bboxStr = match[3];
    const bboxParts = bboxStr.split(',').map(Number);
    if (bboxParts.length === 4 && !bboxParts.some(isNaN)) {
      parsed.push({
        name: region ? `${region}, ${country}` : country,
        country: country,
        region: region || null,
        bbox: bboxParts // [south, west, north, east]
      });
    }
  }
  if (parsed.length > 0) {
    REGIONS.length = 0;
    REGIONS.push(...parsed);
  }
}

function getRegionForPoint(lat, lng) {
  let best = null;
  let smallestArea = Infinity;
  for (const r of REGIONS) {
    const [s, w, n, e] = r.bbox;
    if (lat >= s && lat <= n && lng >= w && lng <= e) {
      const area = (n - s) * (e - w);
      if (area < smallestArea) {
        smallestArea = area;
        best = r;
      }
    }
  }
  return best;
}

function getEstimatedTimezoneOffset(lat, lng, country) {
  if (country) {
    const c = country.toLowerCase();
    if (c === 'india') return 5.5;
    if (c === 'china') return 8;
    if (c === 'japan') return 9;
    if (c === 'south korea') return 9;
    if (c === 'united kingdom' || c === 'uk' || c === 'ireland') return 0;
    if (c === 'france' || c === 'germany' || c === 'spain' || c === 'italy' || c === 'netherlands' || c === 'belgium' || c === 'switzerland' || c === 'austria') return 1;
    if (c === 'turkey' || c === 'greece' || c === 'ukraine' || c === 'finland' || c === 'romania' || c === 'egypt' || c === 'israel' || c === 'jordan') return 2;
    if (c === 'saudi arabia' || c === 'iraq' || c === 'kenya' || c === 'russia') {
      if (c === 'russia') return Math.round(lng / 15);
      return 3;
    }
    if (c === 'uae') return 4;
    if (c === 'pakistan') return 5;
    if (c === 'bangladesh') return 6;
    if (c === 'thailand' || c === 'indonesia' || c === 'vietnam') {
      if (lng > 110) return 8;
      return 7;
    }
    if (c === 'singapore' || c === 'malaysia' || c === 'philippines' || c === 'taiwan') return 8;
    if (c === 'australia') {
      if (lng < 125) return 8;
      if (lng < 140) return 9.5;
      return 10;
    }
    if (c === 'new zealand') return 12;
    if (c === 'argentina' || c === 'brazil') {
      if (c === 'brazil' && lng < -50) return -4;
      return -3;
    }
    if (c === 'chile' || c === 'peru' || c === 'colombia' || c === 'ecuador') return -5;
    if (c === 'mexico') {
      if (lng < -100) return -7;
      return -6;
    }
    if (c === 'usa' || c === 'united states') {
      if (lng < -115) return -8;
      if (lng < -102) return -7;
      if (lng < -85) return -6;
      return -5;
    }
  }
  return Math.round(lng / 15);
}

function detectFrequentLocations() {
  homeLocations = [];
  if (!allVisits.length) return;
  const clusters = [];
  for (const v of allVisits) {
    let found = false;
    for (const c of clusters) {
      const dist = haversineKm(v.lat, v.lng, c.lat, c.lng) * 1000;
      if (dist <= SETTINGS.homeRadiusM) {
        c.lat = (c.lat * c.count + v.lat) / (c.count + 1);
        c.lng = (c.lng * c.count + v.lng) / (c.count + 1);
        c.count++;
        c.visits.push(v);
        found = true;
        break;
      }
    }
    if (!found) {
      clusters.push({ lat: v.lat, lng: v.lng, count: 1, visits: [v] });
    }
  }
  clusters.sort((a, b) => b.count - a.count);
  const frequent = clusters.filter(c => c.count >= SETTINGS.minFrequentVisits);
  if (frequent.length > 0) {
    homeLocations.push({ lat: frequent[0].lat, lng: frequent[0].lng, count: frequent[0].count, label: 'Home' });
  }
  if (frequent.length > 1) {
    const workCluster = frequent.slice(1).find(c => haversineKm(c.lat, c.lng, frequent[0].lat, frequent[0].lng) >= 1.0);
    if (workCluster) {
      homeLocations.push({ lat: workCluster.lat, lng: workCluster.lng, count: workCluster.count, label: 'Work' });
    }
  }
}

function getSeason(ts) {
  const month = new Date(ts).getMonth();
  if (month === 11 || month === 0 || month === 1) return 'Winter';
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  return 'Autumn';
}

function preprocessData() {
  // Sort raw data by startTime
  rawData.sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));

  allVisits = [];
  allActivities = [];
  allPaths = [];

  for (const rec of rawData) {
    const st = parseTime(rec.startTime);
    const et = parseTime(rec.endTime);
    if (rec.visit) {
      const prob = parseFloat(rec.visit.topCandidate?.probability || 0);
      if (prob < SETTINGS.minVisitProbability) continue;

      const loc = parseGeo(rec.visit.topCandidate?.placeLocation);
      if (!loc) continue;
      const dur = et - st;
      const region = getRegionForPoint(loc.lat, loc.lng);
      const country = region?.country || null;
      const offsetHours = getEstimatedTimezoneOffset(loc.lat, loc.lng, country);
      // Determine local hour at the location
      const localHour = new Date(st + offsetHours * 3600000).getUTCHours();
      allVisits.push({
        startTime: st, endTime: et, duration: dur,
        lat: loc.lat, lng: loc.lng,
        placeId: rec.visit.topCandidate?.placeID,
        semanticType: rec.visit.topCandidate?.semanticType || 'Unknown',
        probability: prob,
        region: region?.name || null,
        country: country,
        timezoneOffset: offsetHours,
        timeOfDay: getTimeOfDay(localHour),
        purpose: getVisitPurpose(dur),
        hidden: false
      });
    } else if (rec.activity) {
      const prob = parseFloat(rec.activity.topCandidate?.probability || 0);
      if (prob < SETTINGS.minActivityProbability) continue;

      const startLoc = parseGeo(rec.activity.start);
      const endLoc = parseGeo(rec.activity.end);
      const distM = parseFloat(rec.activity.distanceMeters || 0);
      const dur = et - st;
      const inferredMode = rec.activity.topCandidate?.type || estimateTravelMode(distM, dur);
      allActivities.push({
        startTime: st, endTime: et, duration: dur,
        startLat: startLoc?.lat, startLng: startLoc?.lng,
        endLat: endLoc?.lat, endLng: endLoc?.lng,
        distanceM: distM,
        mode: inferredMode,
        probability: prob,
        hidden: false
      });
    } else if (rec.timelinePath) {
      const points = (rec.timelinePath || []).map(p => {
        const pt = parseGeo(p.point);
        return pt ? { lat: pt.lat, lng: pt.lng, offsetMin: parseFloat(p.durationMinutesOffsetFromStartTime || 0) } : null;
      }).filter(Boolean);
      if (!points.length) continue;
      allPaths.push({ startTime: st, endTime: et, points, hidden: false });
    }
  }

  detectFrequentLocations();
  buildTrips();
}

function getTripTimePeriodName(start, end) {
  const startDate = new Date(start);
  const startMonth = startDate.getMonth(); // 0-indexed
  const startDay = startDate.getDate();
  
  // Helper to check if a date falls in a range (inclusive)
  const inRange = (m1, d1, m2, d2) => {
    const currentVal = startMonth * 100 + startDay;
    const val1 = m1 * 100 + d1;
    const val2 = m2 * 100 + d2;
    if (val1 <= val2) {
      return currentVal >= val1 && currentVal <= val2;
    } else {
      // Overlap year end (e.g. Dec to Jan)
      return currentVal >= val1 || currentVal <= val2;
    }
  };

  // Major Holidays
  if (inRange(11, 20, 0, 3)) return "Christmas & New Year";
  if (inRange(10, 20, 10, 30)) return "Thanksgiving Season";
  if (inRange(9, 25, 10, 1)) return "Halloween Week";
  if (inRange(2, 20, 3, 25)) return "Easter Break";
  
  // Seasons
  const month = startDate.getMonth();
  if (month >= 5 && month <= 7) return "Summer Trip";
  if (month >= 11 || month <= 1) return "Winter Getaway";
  if (month >= 2 && month <= 4) return "Spring Break";
  return "Autumn Trip";
}

function getTripDurationLabel(days) {
  const rounded = Math.round(days);
  if (rounded <= 0) return "1 day";
  return `${rounded} day${rounded > 1 ? 's' : ''}`;
}

function getPrimaryRegionCentroidAndVisits(visits) {
  if (!visits || !visits.length) return null;
  
  // Group visits into geographic clusters (50km radius)
  const clusters = [];
  visits.forEach(v => {
    let foundCluster = null;
    for (const c of clusters) {
      const dist = haversineKm(v.lat, v.lng, c.lat, c.lng);
      if (dist <= 50) {
        foundCluster = c;
        break;
      }
    }
    if (foundCluster) {
      foundCluster.visits.push(v);
      foundCluster.totalDuration += v.duration || 3600000;
      // Recalculate time-weighted centroid
      let sumLat = 0, sumLng = 0, totalW = 0;
      foundCluster.visits.forEach(vi => {
        const w = vi.duration || 3600000;
        sumLat += vi.lat * w;
        sumLng += vi.lng * w;
        totalW += w;
      });
      foundCluster.lat = sumLat / totalW;
      foundCluster.lng = sumLng / totalW;
    } else {
      clusters.push({
        lat: v.lat,
        lng: v.lng,
        totalDuration: v.duration || 3600000,
        visits: [v]
      });
    }
  });

  // Find the cluster with the highest total duration (the primary region)
  let primaryCluster = clusters[0];
  clusters.forEach(c => {
    if (c.totalDuration > primaryCluster.totalDuration) {
      primaryCluster = c;
    }
  });

  return primaryCluster;
}

function getTripZoomBounds(trip) {
  if (!trip.visits || !trip.visits.length) {
    return trip.bbox;
  }
  const primaryCluster = getPrimaryRegionCentroidAndVisits(trip.visits);
  if (!primaryCluster) return trip.bbox;

  // Sort ALL visits in the trip by distance to this primary centroid
  const sortedVisits = [...trip.visits].sort((a, b) => {
    const distA = haversineKm(a.lat, a.lng, primaryCluster.lat, primaryCluster.lng);
    const distB = haversineKm(b.lat, b.lng, primaryCluster.lat, primaryCluster.lng);
    return distA - distB;
  });

  // Keep the closest 80% of visits
  const countToKeep = Math.max(1, Math.ceil(sortedVisits.length * 0.8));
  const coreVisits = sortedVisits.slice(0, countToKeep);

  const lats = coreVisits.map(v => v.lat);
  const lngs = coreVisits.map(v => v.lng);

  return {
    south: Math.min(...lats),
    north: Math.max(...lats),
    west: Math.min(...lngs),
    east: Math.max(...lngs)
  };
}

function getPrimaryRegionForTrip(visits, activities, paths) {
  if (!visits || !visits.length) return null;
  const primaryCluster = getPrimaryRegionCentroidAndVisits(visits);
  if (!primaryCluster) return null;

  // Count regions/countries among the visits in the primary cluster
  const counts = {};
  primaryCluster.visits.forEach(v => {
    const reg = v.region || v.country;
    if (reg) counts[reg] = (counts[reg] || 0) + 1;
  });

  let bestRegion = null;
  let maxCount = -1;
  for (const [r, cnt] of Object.entries(counts)) {
    if (cnt > maxCount) {
      maxCount = cnt;
      bestRegion = r;
    }
  }

  // Fallback: lookup the centroid itself in REGIONS
  if (!bestRegion) {
    const reg = getRegionForPoint(primaryCluster.lat, primaryCluster.lng);
    bestRegion = reg?.name || reg?.country || null;
  }

  return bestRegion;
}

function generateTripName(primaryRegion, start, end, durationDays) {
  const dest = primaryRegion || "World";
  const period = getTripTimePeriodName(start, end);
  const dur = getTripDurationLabel(durationDays);
  const year = new Date(start).getFullYear();
  
  return `${dest} — ${period} (${dur}, ${year})`;
}

function buildTrips() {
  // Combine all events sorted by time
  const events = [
    ...allVisits.map((v, i) => ({ type: 'visit', idx: i, start: v.startTime, end: v.endTime })),
    ...allActivities.map((a, i) => ({ type: 'activity', idx: i, start: a.startTime, end: a.endTime })),
    ...allPaths.map((p, i) => ({ type: 'path', idx: i, start: p.startTime, end: p.endTime })),
  ].sort((a, b) => a.start - b.start);

  if (!events.length) {
    allTrips = [];
    filteredTrips = [];
    return;
  }

  const gapMs = SETTINGS.tripGapHours * 3600000;
  const minMs = SETTINGS.minTripHours * 3600000;
  const maxMs = (SETTINGS.maxTripDays || 60) * 86400000;

  // 1. Separate events that belong to custom trip ranges
  const customTrips = customTripRanges.map(cr => ({
    id: cr.id,
    name: cr.name,
    start: cr.start,
    end: cr.end,
    events: [],
    isCustom: true
  }));

  const unassignedEvents = [];
  for (const ev of events) {
    let assigned = false;
    for (const ct of customTrips) {
      if (ev.start >= ct.start && ev.end <= ct.end) {
        ct.events.push(ev);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      unassignedEvents.push(ev);
    }
  }

  // Helper to get coordinates
  function getEventCoord(ev) {
    if (ev.type === 'visit') {
      const v = allVisits[ev.idx];
      return v ? { lat: v.lat, lng: v.lng } : null;
    }
    if (ev.type === 'activity') {
      const a = allActivities[ev.idx];
      if (a && a.startLat !== undefined) return { lat: a.startLat, lng: a.startLng };
      if (a && a.endLat !== undefined) return { lat: a.endLat, lng: a.endLng };
      return null;
    }
    if (ev.type === 'path') {
      const p = allPaths[ev.idx];
      if (p && p.points && p.points.length > 0) return { lat: p.points[0].lat, lng: p.points[0].lng };
      return null;
    }
    return null;
  }

  // 2. Cluster unassigned events
  let clusteredTrips = [];
  if (unassignedEvents.length) {
    let current = { events: [unassignedEvents[0]], start: unassignedEvents[0].start, end: unassignedEvents[0].end };
    let lastCoord = getEventCoord(unassignedEvents[0]);

    for (let i = 1; i < unassignedEvents.length; i++) {
      const ev = unassignedEvents[i];
      const wouldExceedMax = (ev.end - current.start) > maxMs;
      const coord = getEventCoord(ev);
      let wouldExceedDist = false;

      if (coord && lastCoord) {
        const dist = haversineKm(lastCoord.lat, lastCoord.lng, coord.lat, coord.lng);
        if (dist > SETTINGS.maxDistanceBetweenStopsKm) {
          wouldExceedDist = true;
        }
      }

      if (ev.start - current.end > gapMs || wouldExceedMax || wouldExceedDist) {
        clusteredTrips.push(current);
        current = { events: [ev], start: ev.start, end: ev.end };
        if (coord) lastCoord = coord;
      } else {
        current.events.push(ev);
        current.end = Math.max(current.end, ev.end);
        if (coord) lastCoord = coord;
      }
    }
    clusteredTrips.push(current);
  }

  // 3. Combine custom and clustered trips
  let trips = [
    ...customTrips.filter(ct => ct.events.length > 0),
    ...clusteredTrips
  ];

  // Filter short trips and annotate
  allTrips = trips
    .filter(t => (t.end - t.start) >= minMs || t.isCustom)
    .map(t => {
      const visits = t.events.filter(e => e.type === 'visit').map(e => allVisits[e.idx]);
      const activities = t.events.filter(e => e.type === 'activity').map(e => allActivities[e.idx]);
      const paths = t.events.filter(e => e.type === 'path').map(e => allPaths[e.idx]);

      // Determine bounding box
      const lats = [], lngs = [];
      visits.forEach(v => { lats.push(v.lat); lngs.push(v.lng); });
      activities.forEach(a => {
        if (a.startLat) { lats.push(a.startLat); lngs.push(a.startLng); }
        if (a.endLat) { lats.push(a.endLat); lngs.push(a.endLng); }
      });
      paths.forEach(p => p.points.forEach(pt => { lats.push(pt.lat); lngs.push(pt.lng); }));

      const bbox = lats.length ? {
        south: Math.min(...lats), north: Math.max(...lats),
        west: Math.min(...lngs), east: Math.max(...lngs)
      } : null;

      // Determine primary region based on most activity
      const region = getPrimaryRegionForTrip(visits, activities, paths);

      // Travel modes
      const modes = [...new Set(activities.map(a => estimateTravelMode(a.distanceM, a.duration)))];

      // Duration
      const durationDays = (t.end - t.start) / 86400000;

      // Auto name
      let name = t.isCustom ? t.name : (region ? `${region} — ${getMonthYear(t.start)}` : `Trip ${getMonthYear(t.start)}`);

      if (!t.isCustom) {
        // Specialty naming for local chores / commutes
        if (homeLocations.length > 0 && bbox) {
          const home = homeLocations[0];
          let maxDist = 0;
          lats.forEach((lat, k) => {
            const dist = haversineKm(lat, lngs[k], home.lat, home.lng);
            if (dist > maxDist) maxDist = dist;
          });

          if (maxDist <= SETTINGS.maxLocalTripRadiusKm) {
            const year = new Date(t.start).getFullYear();
            const season = getSeason(t.start);
            const dur = getTripDurationLabel(durationDays);

            let visitedWork = false;
            let hasWeekday = false;
            const work = homeLocations.find(l => l.label === 'Work');

            visits.forEach(v => {
              const day = new Date(v.startTime).getDay();
              if (day >= 1 && day <= 5) hasWeekday = true;
              if (work && haversineKm(v.lat, v.lng, work.lat, work.lng) * 1000 <= SETTINGS.homeRadiusM) {
                visitedWork = true;
              }
            });

            if (visitedWork && hasWeekday) {
              name = `Home-Work Commute (${dur}, ${year})`;
            } else {
              let weekendVisits = 0;
              visits.forEach(v => {
                const day = new Date(v.startTime).getDay();
                if (day === 0 || day === 6) weekendVisits++;
              });
              if (visits.length > 0 && (weekendVisits / visits.length) >= 0.6) {
                name = `Weekend-Chores ${season} (${dur}, ${year})`;
              } else {
                name = `Local-Chores ${season} (${dur}, ${year})`;
              }
            }
          } else {
            // Normal trip with holiday/season naming
            name = generateTripName(region, t.start, t.end, durationDays);
          }
        } else {
          // Normal trip with holiday/season naming
          name = generateTripName(region, t.start, t.end, durationDays);
        }
      }

      return {
        id: t.id || (Date.now() + Math.random()).toString(36),
        name,
        start: t.start, end: t.end, durationDays,
        visits, activities, paths,
        bbox, region,
        modes, monthYear: getMonthYear(t.start),
        hidden: false,
        isCustom: !!t.isCustom
      };
    });

  // Sort latest to oldest
  allTrips.sort((a, b) => b.start - a.start);

  filteredTrips = [...allTrips];
}

function reprocessData() {
  if (!rawData.length) {
    showToast('No data loaded yet', 'warning');
    return;
  }
  preprocessData();
  renderTripGrid();
  refreshCurrentTripView();
  showToast('Data reprocessed', 'success');
}

// ============================================================
//  DATA INGESTION
// ============================================================
function openUploadModal() { openModal('upload-modal'); }

function onDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-area').classList.add('drag-over');
}
function onDragLeave(e) {
  document.getElementById('upload-area').classList.remove('drag-over');
}
function onDrop(e) {
  e.preventDefault();
  document.getElementById('upload-area').classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json'));
  if (!files.length) { showToast('Please drop a .json file', 'error'); return; }
  processFiles(files);
}
function onFileSelect(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  processFiles(files);
  e.target.value = '';
}

async function processFiles(files) {
  const progressEl = document.getElementById('upload-progress');
  const progressBar = document.getElementById('progress-bar');
  const statusEl = document.getElementById('upload-status');
  progressEl.style.display = 'block';
  statusEl.textContent = `Reading ${files.length} file(s)...`;
  progressBar.style.width = '10%';

  let newRecords = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    statusEl.textContent = `Parsing ${f.name}...`;
    try {
      const text = await f.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch(e) { showToast(`${f.name}: Invalid JSON format`, 'error'); continue; }

      // Support both array and {semanticSegments: [...]} format
      let records = Array.isArray(parsed) ? parsed : (parsed.semanticSegments || parsed.timelineObjects || []);
      if (!records.length) { showToast(`${f.name}: No timeline records found`, 'warning'); continue; }
      rawData = rawData.concat(records);
      newRecords += records.length;
    } catch(e) {
      showToast(`Failed to read ${f.name}: ${e.message}`, 'error');
    }
    progressBar.style.width = `${10 + 60 * (i+1) / files.length}%`;
  }

  if (newRecords === 0) {
    progressEl.style.display = 'none';
    return;
  }

  statusEl.textContent = `Processing ${newRecords} records...`;
  progressBar.style.width = '75%';

  await new Promise(r => setTimeout(r, 30)); // yield to UI
  preprocessData();

  progressBar.style.width = '100%';
  statusEl.textContent = `Done! Found ${allTrips.length} trips.`;
  setTimeout(() => {
    progressEl.style.display = 'none';
    closeModal('upload-modal');
    renderTripGrid();
    // Allow the modal close transition (0.2s) to finish, then render the overview map
    setTimeout(() => {
      if (typeof map !== 'undefined' && map) map.invalidateSize();
      renderCurrentTrip();
    }, 250);
    showToast(`Loaded ${newRecords} records across ${allTrips.length} trips`, 'success');
  }, 800);
}

