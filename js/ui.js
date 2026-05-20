// ============================================================
//  UI RENDERING, MODALS, PANELS, FILTERS & INTERACTIONS
// ============================================================

let collapsedClusters = new Set();
let currentDbEditType = '';
let currentDbEditIndex = -1;

function toggleFilter() {
  const p = document.getElementById('filter-panel');
  const btn = document.getElementById('btn-filter');
  p.classList.toggle('open');
  btn.classList.toggle('active');
}

function applyFilters() {
  const dateFrom = document.getElementById('filter-date-from').value;
  const dateTo = document.getElementById('filter-date-to').value;
  const region = document.getElementById('filter-region').value.toLowerCase().trim();
  const minDur = parseFloat(document.getElementById('filter-min-dur').value) || 0;
  const maxDur = parseFloat(document.getElementById('filter-max-dur').value) || Infinity;
  const mode = document.getElementById('filter-mode').value.toLowerCase();
  const filterViewport = document.getElementById('filter-viewport').checked;

  filteredTrips = allTrips.filter(t => {
    if (dateFrom && t.start < new Date(dateFrom).getTime()) return false;
    if (dateTo && t.end > new Date(dateTo).getTime() + 86400000) return false;
    if (region && !(t.name.toLowerCase().includes(region) || (t.region || '').toLowerCase().includes(region))) return false;
    if (t.durationDays < minDur) return false;
    if (t.durationDays > maxDur) return false;
    if (mode && !t.modes.some(m => m.toLowerCase().includes(mode))) return false;
    
    if (filterViewport) {
      if (!t.bbox) return false;
      const mapBounds = map.getBounds();
      const tripBounds = L.latLngBounds(
        [t.bbox.south, t.bbox.west],
        [t.bbox.north, t.bbox.east]
      );
      if (!mapBounds.intersects(tripBounds)) return false;
    }
    
    return true;
  });

  renderTripGrid();
}

function clearFilters() {
  ['filter-date-from', 'filter-date-to', 'filter-region', 'filter-min-dur', 'filter-max-dur'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('filter-mode').value = '';
  document.getElementById('filter-viewport').checked = false;
  filteredTrips = [...allTrips];
  renderTripGrid();
}

function toggleSidePanelMinimize() {
  const panel = document.getElementById('side-panel');
  const icon = document.getElementById('sp-toggle-icon');
  if (!panel || !icon) return;
  panel.classList.toggle('minimized');
  if (panel.classList.contains('minimized')) {
    icon.className = 'fa-solid fa-chevron-left';
  } else {
    icon.className = 'fa-solid fa-chevron-right';
  }
}

function viewTrip(idx) {
  if (idx < 0 || idx >= allTrips.length) return;
  currentTripIdx = idx;
  currentTrip = allTrips[idx];
  currentTripId = currentTrip.id;

  const panel = document.getElementById('side-panel');
  if (panel) {
    panel.classList.remove('minimized');
  }
  const icon = document.getElementById('sp-toggle-icon');
  if (icon) icon.className = 'fa-solid fa-chevron-right';

  document.getElementById('sp-trip-name').textContent = currentTrip.name;
  document.getElementById('side-panel').classList.add('open');
  
  const mainPanel = document.getElementById('main-panel');
  if (mainPanel) mainPanel.style.display = 'none';

  renderSidePanel('overview');
  renderCurrentTrip();
  fitMapToTrip(currentTrip);
}

function closeSidePanel() {
  const panel = document.getElementById('side-panel');
  if (panel) {
    panel.classList.remove('open');
    panel.classList.remove('minimized');
  }
  const icon = document.getElementById('sp-toggle-icon');
  if (icon) icon.className = 'fa-solid fa-chevron-right';

  clearMapLayers();
  currentTrip = null;
  currentTripIdx = -1;
  currentTripId = null;
  closeTimeline();
  
  const mainPanel = document.getElementById('main-panel');
  if (mainPanel) mainPanel.style.display = 'flex';
  
  if (typeof map !== 'undefined' && map) map.invalidateSize();
  renderCurrentTrip();
}

function refreshCurrentTripView() {
  if (!currentTripId) {
    renderCurrentTrip();
    return;
  }
  const newIdx = allTrips.findIndex(t => t.id === currentTripId);
  if (newIdx >= 0) {
    currentTripIdx = newIdx;
    currentTrip = allTrips[newIdx];
    document.getElementById('sp-trip-name').textContent = currentTrip.name;
    renderSidePanel(currentSpTab);
    renderCurrentTrip();
  } else {
    closeSidePanel();
  }
}

function toggleClusterCollapse(groupName) {
  const grid = document.getElementById(`cluster-grid-${groupName}`);
  const chevron = document.getElementById(`cluster-chevron-${groupName}`);
  if (collapsedClusters.has(groupName)) {
    collapsedClusters.delete(groupName);
    if (grid) grid.style.display = 'grid';
    if (chevron) {
      chevron.classList.remove('fa-chevron-down');
      chevron.classList.add('fa-chevron-up');
    }
  } else {
    collapsedClusters.add(groupName);
    if (grid) grid.style.display = 'none';
    if (chevron) {
      chevron.classList.remove('fa-chevron-up');
      chevron.classList.add('fa-chevron-down');
    }
  }
}

function toggleTripsViewMode() {
  SETTINGS.tripsViewMode = SETTINGS.tripsViewMode === 'minimal' ? 'regular' : 'minimal';
  const btn = document.getElementById('btn-view-mode');
  if (btn) {
    const isMinimal = SETTINGS.tripsViewMode === 'minimal';
    btn.title = isMinimal ? 'Switch to card view' : 'Switch to compact view';
    btn.querySelector('i').className = isMinimal ? 'fa-solid fa-table-cells-large' : 'fa-solid fa-list';
  }
  renderTripGrid();
}

function toggleTripsCollapsed() {
  const section = document.getElementById('trips-section');
  const isNowCollapsed = section.classList.toggle('collapsed');
  const btn = document.getElementById('btn-trips-collapse');
  if (btn) {
    btn.title = isNowCollapsed ? 'Expand trips panel' : 'Collapse trips panel';
  }
}

// Allow clicking the header bar itself (not controls) to collapse/expand
function handleTripsHeaderClick(event) {
  // Only trigger if the click target is the header or its h2/trip-count — not a child button/select
  const tag = event.target.tagName.toLowerCase();
  if (tag === 'button' || tag === 'select' || tag === 'option' || tag === 'input') return;
  if (event.target.closest('button, select')) return;
  toggleTripsCollapsed();
}


function toggleShowStarredOnly() {
  showStarredOnly = !showStarredOnly;
  const btn = document.getElementById('btn-starred-filter');
  if (btn) {
    btn.classList.toggle('active', showStarredOnly);
    btn.title = showStarredOnly ? 'Showing starred only — click to show all' : 'Show starred trips only';
  }
  renderTripGrid();
}

function toggleStarTrip(idx, event) {
  if (event) event.stopPropagation();
  allTrips[idx].starred = !allTrips[idx].starred;
  renderTripGrid();
}

function createTripCard(trip, realIdx) {
  const isMinimal = SETTINGS.tripsViewMode === 'minimal';
  const card = document.createElement('div');
  card.className = isMinimal ? 'trip-card minimal' : 'trip-card';
  const modeIcons = trip.modes.slice(0, 3).map(m => `<i class="fa-solid ${getModeIcon(m)}" title="${m}"></i>`).join(' ');
  const starFill = trip.starred ? 'solid' : 'regular';
  const starColor = trip.starred ? 'color:var(--accent3);' : 'color:var(--text3);';

  if (isMinimal) {
    card.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;height:auto;border-radius:8px;cursor:default;background:var(--surface2);border:1px solid var(--border);transition:var(--transition);';
    card.innerHTML = `
      <button onclick="toggleStarTrip(${realIdx},event)" style="background:none;border:none;padding:0;cursor:pointer;font-size:13px;flex-shrink:0;${starColor}" title="${trip.starred ? 'Unstar' : 'Star'} trip">
        <i class="fa-${starFill} fa-star"></i>
      </button>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${trip.name}">${trip.name}</div>
        <div style="font-size:11px;color:var(--text2);display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <span>${fmtDate(trip.start)}</span>
          ${trip.durationDays >= 1 ? `<span style="background:var(--surface3);padding:2px 5px;border-radius:4px;font-size:10px;">${Math.round(trip.durationDays)}d</span>` : ''}
          <span>${modeIcons}</span>
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0;">
        <button class="view" onclick="viewTrip(${realIdx})" style="height:26px;padding:0 10px;border-radius:5px;border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:11px;cursor:pointer;"><i class="fa-solid fa-eye"></i></button>
        <button onclick="openRenameModal(${realIdx})" style="width:26px;height:26px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--text2);font-size:11px;cursor:pointer;"><i class="fa-solid fa-pen"></i></button>
        <button onclick="deleteTrip(${realIdx})" style="width:26px;height:26px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--accent2);font-size:11px;cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
  } else {
    card.style.height = '210px';
    card.innerHTML = `
      <div class="trip-card-map" id="trip-map-${realIdx}" style="position:relative;">
        <canvas width="200" height="100" id="trip-canvas-${realIdx}"></canvas>
        <button onclick="toggleStarTrip(${realIdx},event)" style="position:absolute;top:6px;right:6px;background:rgba(22,26,35,0.75);border:none;padding:4px 6px;border-radius:6px;cursor:pointer;font-size:13px;${starColor}" title="${trip.starred ? 'Unstar' : 'Star'} trip">
          <i class="fa-${starFill} fa-star"></i>
        </button>
      </div>
      <div class="trip-card-body" style="flex:1; display:flex; flex-direction:column; justify-content:space-between; padding:10px 12px; overflow:hidden;">
        <div>
          <div class="trip-card-name" title="${trip.name}" style="font-size:13px; font-weight:600; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${trip.name}</div>
          <div class="trip-card-meta" style="font-size:11px; color:var(--text2); display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <span>${fmtDate(trip.start)}</span>
            ${trip.durationDays >= 1 ? `<span class="trip-tag" style="background:var(--surface3); padding:2px 6px; border-radius:4px; font-size:10px;">${Math.round(trip.durationDays)}d</span>` : ''}
            ${modeIcons}
          </div>
        </div>
      </div>
      <div class="trip-card-actions" style="display:flex; gap:4px; padding:6px 8px 8px;">
        <button class="view" onclick="viewTrip(${realIdx})" style="flex:1; height:26px; border-radius:5px; border:1px solid var(--accent); background:transparent; color:var(--accent); font-size:11px; transition:var(--transition); cursor:pointer;"><i class="fa-solid fa-eye"></i> View</button>
        <button onclick="openRenameModal(${realIdx})" style="width:30px; height:26px; border-radius:5px; border:1px solid var(--border); background:transparent; color:var(--text2); font-size:11px; transition:var(--transition); cursor:pointer;"><i class="fa-solid fa-pen"></i></button>
        <button onclick="deleteTrip(${realIdx})" style="width:30px; height:26px; border-radius:5px; border:1px solid var(--border); background:transparent; color:var(--accent2); font-size:11px; transition:var(--transition); cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    card.querySelector('.trip-card-map').addEventListener('click', (e) => { if (!e.target.closest('button')) viewTrip(realIdx); });
  }
  return card;
}

function renderTripGrid() {
  const welcomeCard = document.getElementById('welcome-card');
  if (welcomeCard) {
    welcomeCard.style.display = allTrips.length > 0 ? 'none' : 'block';
  }

  const grid = document.getElementById('trips-grid');
  const badge = document.getElementById('trip-count-badge');
  // Apply starred-only filter on top of filteredTrips
  const trips = showStarredOnly ? filteredTrips.filter(t => t.starred) : filteredTrips;
  badge.textContent = `${trips.length} trip${trips.length !== 1 ? 's' : ''}`;

  if (!trips.length) {
    grid.innerHTML = showStarredOnly
      ? `<div class="empty-trips"><i class="fa-solid fa-star"></i><p>No starred trips. Click the ★ on any trip card to star it.</p></div>`
      : `<div class="empty-trips"><i class="fa-solid fa-suitcase-rolling"></i><p>No trips found. Upload your timeline data or adjust filters.</p></div>`;
    return;
  }

  grid.innerHTML = '';
  const isMinimal = SETTINGS.tripsViewMode === 'minimal';
  
  if (!SETTINGS.clusterMode) {
    if (isMinimal) {
      grid.style.display = 'flex';
      grid.style.flexDirection = 'column';
      grid.style.gridTemplateColumns = '';
    } else {
      grid.style.display = 'grid';
      grid.style.flexDirection = '';
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
    }
    
    trips.forEach((trip) => {
      const realIdx = allTrips.indexOf(trip);
      const card = createTripCard(trip, realIdx);
      grid.appendChild(card);
      if (!isMinimal) drawTripThumbnail(trip, realIdx);
    });
  } else {
    grid.style.display = 'block';
    grid.style.flexDirection = '';
    grid.style.gridTemplateColumns = '';
    
    const groups = {};
    trips.forEach(trip => {
      let key = 'Other';
      if (SETTINGS.clusterCriterion === 'year') {
        key = new Date(trip.start).getFullYear().toString();
      } else if (SETTINGS.clusterCriterion === 'region') {
        key = trip.region || 'Multiple Regions';
      } else if (SETTINGS.clusterCriterion === 'season') {
        key = getSeason(trip.start);
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(trip);
    });
    
    const keys = Object.keys(groups).sort((a, b) => {
      if (SETTINGS.clusterCriterion === 'year') {
        return parseInt(b) - parseInt(a);
      }
      return a.localeCompare(b);
    });
    
    keys.forEach(key => {
      const groupTrips = groups[key];
      const isCollapsed = collapsedClusters.has(key);
      
      const clusterWrap = document.createElement('div');
      clusterWrap.className = 'cluster-group';
      clusterWrap.style.marginBottom = '14px';
      
      const header = document.createElement('div');
      header.className = 'cluster-header';
      header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;cursor:pointer;user-select:none;font-weight:600;font-size:13px;transition:var(--transition);margin-bottom:8px;';
      header.onclick = () => toggleClusterCollapse(key);
      
      header.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
          <i class="fa-solid fa-folder-open" style="color:var(--accent)"></i>
          <span>${key}</span>
          <span style="font-size:11px;font-weight:normal;color:var(--text2);">(${groupTrips.length} trip${groupTrips.length !== 1 ? 's' : ''})</span>
        </div>
        <i class="fa-solid ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}" id="cluster-chevron-${key}" style="color:var(--text2);font-size:11px;"></i>
      `;
      
      const subGrid = document.createElement('div');
      subGrid.id = `cluster-grid-${key}`;
      subGrid.className = 'cluster-grid';
      if (isMinimal) {
        subGrid.style.cssText = `display:${isCollapsed ? 'none' : 'flex'}; flex-direction:column; gap:6px; padding: 4px 0 10px 0;`;
      } else {
        subGrid.style.cssText = `display:${isCollapsed ? 'none' : 'grid'}; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; padding: 4px 0 10px 0;`;
      }
      
      groupTrips.forEach(trip => {
        const realIdx = allTrips.indexOf(trip);
        const card = createTripCard(trip, realIdx);
        subGrid.appendChild(card);
        if (!isMinimal) drawTripThumbnail(trip, realIdx);
      });
      
      clusterWrap.appendChild(header);
      clusterWrap.appendChild(subGrid);
      grid.appendChild(clusterWrap);
    });
  }
}

function drawTripThumbnail(trip, idx) {
  setTimeout(() => {
    const canvas = document.getElementById(`trip-canvas-${idx}`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#1a1e2a';
    ctx.fillRect(0, 0, W, H);

    const allLats = [], allLngs = [];
    trip.visits.forEach(v => { allLats.push(v.lat); allLngs.push(v.lng); });
    trip.activities.forEach(a => { if (a.startLat) { allLats.push(a.startLat, a.endLat); allLngs.push(a.startLng, a.endLng); } });
    trip.paths.forEach(p => p.points.forEach(pt => { allLats.push(pt.lat); allLngs.push(pt.lng); }));

    if (!allLats.length) return;

    const minLat = Math.min(...allLats), maxLat = Math.max(...allLats);
    const minLng = Math.min(...allLngs), maxLng = Math.max(...allLngs);
    const pad = 10;

    function toXY(lat, lng) {
      const latRange = maxLat - minLat || 0.01;
      const lngRange = maxLng - minLng || 0.01;
      const scale = Math.min((W - pad * 2) / lngRange, (H - pad * 2) / latRange);
      const centerX = W / 2, centerY = H / 2;
      const x = centerX + (lng - (minLng + maxLng) / 2) * scale;
      const y = centerY - (lat - (minLat + maxLat) / 2) * scale;
      return [x, y];
    }

    // Draw paths
    trip.paths.forEach(p => {
      if (p.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(79,255,176,0.6)';
      ctx.lineWidth = 1.5;
      p.points.forEach((pt, i) => {
        const [x, y] = toXY(pt.lat, pt.lng);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
    });

    // Draw activities
    trip.activities.forEach(a => {
      if (!a.startLat || !a.endLat) return;
      const [x1, y1] = toXY(a.startLat, a.startLng);
      const [x2, y2] = toXY(a.endLat, a.endLng);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(116,185,255,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Draw visit dots
    trip.visits.forEach(v => {
      const [x, y] = toXY(v.lat, v.lng);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#4fffb0';
      ctx.fill();
    });
  }, 50);
}

function editVisitInline(vi) {
  const v = currentTrip.visits[vi];
  const popupContent = `
    <div class="popup-title">Edit Stop</div>
    <div style="margin-bottom:8px;">
      <label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Name / Place Type</label>
      <input type="text" id="edit-v-name" value="${v.semanticType || ''}" style="width:100%;height:28px;border-radius:5px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 8px;font-size:12px;">
    </div>
    <div style="margin-bottom:8px;">
      <label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Marker Color</label>
      <select id="edit-v-color" style="width:100%;height:28px;border-radius:5px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 8px;font-size:12px;">
        <option value="#4fffb0" ${v.customColor === '#4fffb0' ? 'selected' : ''}>Green (Default)</option>
        <option value="#ffd166" ${v.customColor === '#ffd166' ? 'selected' : ''}>Yellow (Hotel/Stay)</option>
        <option value="#ff6b6b" ${v.customColor === '#ff6b6b' ? 'selected' : ''}>Red</option>
        <option value="#74b9ff" ${v.customColor === '#74b9ff' ? 'selected' : ''}>Blue</option>
        <option value="#a29bfe" ${v.customColor === '#a29bfe' ? 'selected' : ''}>Purple</option>
      </select>
    </div>
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button class="btn sm accent" onclick="saveVisitInline(${vi})">Save</button>
      <button class="btn sm ghost" onclick="renderCurrentTrip()">Cancel</button>
    </div>
  `;
  const popup = map._popup;
  if (popup) {
    popup.setContent(popupContent);
  }
}

function saveVisitInline(vi) {
  const name = document.getElementById('edit-v-name').value.trim() || 'Visit';
  const color = document.getElementById('edit-v-color').value;
  currentTrip.visits[vi].semanticType = name;
  currentTrip.visits[vi].customColor = color;
  renderCurrentTrip();
  renderSidePanel('stops');
  map.closePopup();
  showToast('Stop updated', 'success');
}

function switchSpTab(btn, tab) {
  document.querySelectorAll('.sp-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentSpTab = tab;
  renderSidePanel(tab);
}

function renderSidePanel(tab) {
  const body = document.getElementById('sp-body');
  const trip = currentTrip;
  if (!trip) return;

  if (tab === 'overview') {
    const totalDist = trip.activities.reduce((s, a) => s + (a.distanceM || 0), 0);
    const stops = trip.visits.length;
    const modesList = trip.modes.map(m => `<span class="mode-pill"><i class="fa-solid ${getModeIcon(m)}"></i> ${m}</span>`).join('');
    body.innerHTML = `
      <div class="info-card">
        <div class="info-card-title">Trip Summary</div>
        <div class="stat-row"><span class="stat-label">Dates</span><span class="stat-value">${fmtDate(trip.start)} – ${fmtDate(trip.end)}</span></div>
        <div class="stat-row"><span class="stat-label">Duration</span><span class="stat-value">${fmtDuration(trip.end - trip.start)}</span></div>
        <div class="stat-row"><span class="stat-label">Stops</span><span class="stat-value">${stops}</span></div>
        <div class="stat-row"><span class="stat-label">Distance</span><span class="stat-value">${(totalDist / 1000).toFixed(0)} km</span></div>
        <div class="stat-row"><span class="stat-label">Region</span><span class="stat-value">${trip.region || 'Multiple'}</span></div>
        <div style="margin-top:8px">${modesList || '<span class="stat-label">No activities</span>'}</div>
      </div>
      <div class="info-card">
        <div class="info-card-title">Quick Actions</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn sm accent" onclick="toggleTimeline()"><i class="fa-solid fa-film"></i> Play Timeline</button>
          <button class="btn sm ghost" onclick="fitMapToTrip(currentTrip)"><i class="fa-solid fa-expand"></i> Fit Map</button>
          <button class="btn sm ghost" onclick="openShareTrip()"><i class="fa-solid fa-share-nodes"></i> Share</button>
        </div>
      </div>
      <div class="info-card">
        <div class="info-card-title">Data Counts</div>
        <div class="stat-row"><span class="stat-label">Visit records</span><span class="stat-value">${trip.visits.length}</span></div>
        <div class="stat-row"><span class="stat-label">Activity records</span><span class="stat-value">${trip.activities.length}</span></div>
        <div class="stat-row"><span class="stat-label">Path segments</span><span class="stat-value">${trip.paths.length}</span></div>
        <div class="stat-row"><span class="stat-label">Path points</span><span class="stat-value">${trip.paths.reduce((s, p) => s + p.points.length, 0)}</span></div>
      </div>
    `;
  } else if (tab === 'stops') {
    const html = trip.visits.length ? trip.visits.map((v, i) => {
      const globalIdx = allVisits.indexOf(v);
      return `
      <div class="stop-item" style="position:relative; cursor:pointer;" onclick="if(!event.target.closest('.stop-actions')) map.setView([${v.lat},${v.lng}],14)">
        <div class="stop-dot" style="background:${v.purpose === 'overnight stay' ? '#ffd166' : '#4fffb0'}">
          <i class="fa-solid ${v.purpose === 'overnight stay' ? 'fa-bed' : 'fa-location-dot'}" style="font-size:10px;color:#000"></i>
        </div>
        <div class="stop-info" style="flex:1; padding-right:55px;">
          <div class="stop-name">${v.semanticType || 'Visit'} ${v.region ? '· ' + v.region : ''}</div>
          <div class="stop-meta">
            <span>${fmtDateTime(v.startTime)}</span>
            <span class="stop-badge">${v.purpose}</span>
            <span class="stop-badge">${v.timeOfDay}</span>
            ${v.hidden ? '<span class="stop-badge" style="color:var(--accent2)">hidden</span>' : ''}
          </div>
        </div>
        <div class="stop-actions" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); display:flex; gap:4px; z-index:10;">
          <button class="btn sm ghost" onclick="event.stopPropagation(); openDbEdit('visit', ${globalIdx})" style="padding:4px 8px; border-radius:4px; height:24px; width:24px; display:flex; align-items:center; justify-content:center;" title="Edit Stop"><i class="fa-solid fa-pen" style="font-size:10px;"></i></button>
          <button class="btn sm ghost" onclick="event.stopPropagation(); deleteDbRecord('visit', ${globalIdx})" style="padding:4px 8px; border-radius:4px; height:24px; width:24px; display:flex; align-items:center; justify-content:center; color:var(--accent2);" title="Delete Stop"><i class="fa-solid fa-trash" style="font-size:10px;"></i></button>
        </div>
      </div>
      `;
    }).join('') : '<p style="color:var(--text3);font-size:13px;text-align:center;padding:20px">No stop data available</p>';
    body.innerHTML = `<div style="font-size:12px;color:var(--text2);margin-bottom:8px;">${trip.visits.length} stops — click to zoom map</div>${html}`;
  } else if (tab === 'routes') {
    const acts = trip.activities.map((a, i) => {
      const globalIdx = allActivities.indexOf(a);
      const mode = estimateTravelMode(a.distanceM || 0, a.duration);
      const dist = a.distanceM ? `${(a.distanceM / 1000).toFixed(1)} km` : 'unknown';
      return `<div class="stop-item" style="position:relative; cursor:pointer;" onclick="if(!event.target.closest('.stop-actions')) ${a.startLat ? `map.setView([${a.startLat},${a.startLng}],12)` : ''}">
        <div class="stop-dot" style="background:${getModeColor(mode)}">
          <i class="fa-solid ${getModeIcon(mode)}" style="font-size:10px;color:#000"></i>
        </div>
        <div class="stop-info" style="flex:1; padding-right:55px;">
          <div class="stop-name">${mode.charAt(0).toUpperCase() + mode.slice(1)}</div>
          <div class="stop-meta">
            <span>${fmtDateTime(a.startTime)}</span>
            <span class="stop-badge">${dist}</span>
            <span class="stop-badge">${fmtDuration(a.duration)}</span>
          </div>
        </div>
        <div class="stop-actions" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); display:flex; gap:4px; z-index:10;">
          <button class="btn sm ghost" onclick="event.stopPropagation(); openDbEdit('activity', ${globalIdx})" style="padding:4px 8px; border-radius:4px; height:24px; width:24px; display:flex; align-items:center; justify-content:center;" title="Edit Activity"><i class="fa-solid fa-pen" style="font-size:10px;"></i></button>
          <button class="btn sm ghost" onclick="event.stopPropagation(); deleteDbRecord('activity', ${globalIdx})" style="padding:4px 8px; border-radius:4px; height:24px; width:24px; display:flex; align-items:center; justify-content:center; color:var(--accent2);" title="Delete Activity"><i class="fa-solid fa-trash" style="font-size:10px;"></i></button>
        </div>
      </div>`;
    }).join('');
    const pathsHtml = trip.paths.map((p, i) => {
      const globalIdx = allPaths.indexOf(p);
      return `
      <div class="stop-item" style="position:relative; cursor:pointer;" onclick="if(!event.target.closest('.stop-actions')) ${p.points.length ? `map.setView([${p.points[0].lat},${p.points[0].lng}],13)` : ''}">
        <div class="stop-dot" style="background:var(--accent)"><i class="fa-solid fa-route" style="font-size:10px;color:#000"></i></div>
        <div class="stop-info" style="flex:1; padding-right:55px;">
          <div class="stop-name">Path segment · ${p.points.length} points</div>
          <div class="stop-meta"><span>${fmtDateTime(p.startTime)}</span><span class="stop-badge">${fmtDuration(p.endTime - p.startTime)}</span></div>
        </div>
        <div class="stop-actions" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); display:flex; gap:4px; z-index:10;">
          <button class="btn sm ghost" onclick="event.stopPropagation(); openDbEdit('path', ${globalIdx})" style="padding:4px 8px; border-radius:4px; height:24px; width:24px; display:flex; align-items:center; justify-content:center;" title="Edit Path"><i class="fa-solid fa-pen" style="font-size:10px;"></i></button>
          <button class="btn sm ghost" onclick="event.stopPropagation(); deleteDbRecord('path', ${globalIdx})" style="padding:4px 8px; border-radius:4px; height:24px; width:24px; display:flex; align-items:center; justify-content:center; color:var(--accent2);" title="Delete Path"><i class="fa-solid fa-trash" style="font-size:10px;"></i></button>
        </div>
      </div>
      `;
    }).join('');
    body.innerHTML = `
      ${trip.activities.length ? `<div class="info-card-title" style="margin-bottom:8px;font-size:11px;font-weight:600;color:var(--text2)">ACTIVITIES</div>${acts}` : ''}
      ${trip.paths.length ? `<div class="info-card-title" style="margin:12px 0 8px;font-size:11px;font-weight:600;color:var(--text2)">PATH SEGMENTS</div>${pathsHtml}` : ''}
      ${!trip.activities.length && !trip.paths.length ? '<p style="color:var(--text3);font-size:13px;text-align:center;padding:20px">No route data available</p>' : ''}
    `;
  } else if (tab === 'customize') {
    if (!currentTrip.style) currentTrip.style = {};
    const s = currentTrip.style;
    const S = SETTINGS; // fallback defaults
    const bm = s.basemap !== undefined ? s.basemap : currentBasemap;
    const pc = s.pathColor || S.pathColor;
    const pw = s.pathWidth || S.pathWidth;
    const fc = s.flightColor || S.flightColor || '#a0a0a0';
    const fw = s.flightWidth || S.flightWidth || 2;
    const mc = s.markerColor || S.markerColor || '#4fffb0';
    const mi = s.markerIcon  || S.markerIcon  || 'fa-location-dot';
    const ms = s.markerSize  || S.markerSize  || 'medium';

    body.innerHTML = `
      <div class="info-card" style="margin-bottom:0">
        <div class="info-card-title">Trip Base Map</div>
        <div class="setting-row"><span class="setting-label">Basemap</span>
          <select style="height:30px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 8px;font-size:12px" onchange="setTripStyleProp('basemap',+this.value);setBasemap(this.value)">
            ${BASEMAPS.map((b, i) => `<option value="${i}" ${i === bm ? 'selected' : ''}>${b.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="info-card" style="margin-bottom:0">
        <div class="info-card-title">Path Style</div>
        <div class="setting-row"><span class="setting-label">Path Color</span>
          <input type="color" value="${pc}" oninput="setTripStyleProp('pathColor',this.value);renderCurrentTrip()" style="width:40px;height:28px;border-radius:5px;border:1px solid var(--border);background:transparent;cursor:pointer">
        </div>
        <div class="setting-row"><span class="setting-label">Path Width</span>
          <input type="range" min="1" max="8" value="${pw}" style="width:120px" oninput="setTripStyleProp('pathWidth',+this.value);renderCurrentTrip()">
        </div>
        <div class="setting-row"><span class="setting-label">Flight Color</span>
          <input type="color" value="${fc}" oninput="setTripStyleProp('flightColor',this.value);renderCurrentTrip()" style="width:40px;height:28px;border-radius:5px;border:1px solid var(--border);background:transparent;cursor:pointer">
        </div>
        <div class="setting-row"><span class="setting-label">Flight Width</span>
          <input type="range" min="1" max="8" value="${fw}" style="width:120px" oninput="setTripStyleProp('flightWidth',+this.value);renderCurrentTrip()">
        </div>
      </div>
      <div class="info-card" style="margin-bottom:0">
        <div class="info-card-title">Marker Style</div>
        <div class="setting-row"><span class="setting-label">Marker Color</span>
          <div style="display:flex;gap:6px;align-items:center;">
            <select onchange="setTripStyleProp('markerColor',this.value);renderCurrentTrip()" style="height:30px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 8px;font-size:12px;width:110px">
              <option value="#4fffb0" ${mc==='#4fffb0'?'selected':''}>Vibrant Mint</option>
              <option value="#3b82f6" ${mc==='#3b82f6'?'selected':''}>Royal Blue</option>
              <option value="#ec4899" ${mc==='#ec4899'?'selected':''}>Coral Pink</option>
              <option value="#a855f7" ${mc==='#a855f7'?'selected':''}>Electric Purple</option>
              <option value="#ff7a00" ${mc==='#ff7a00'?'selected':''}>Neon Orange</option>
              <option value="#ff3333" ${mc==='#ff3333'?'selected':''}>Crimson Red</option>
            </select>
            <input type="color" value="${mc}" oninput="setTripStyleProp('markerColor',this.value);renderCurrentTrip()" style="width:30px;height:28px;border-radius:5px;border:1px solid var(--border);background:transparent;cursor:pointer">
          </div>
        </div>
        <div class="setting-row"><span class="setting-label">Marker Icon</span>
          <select onchange="setTripStyleProp('markerIcon',this.value);renderCurrentTrip()" style="height:30px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 8px;font-size:12px">
            <option value="fa-location-dot" ${mi==='fa-location-dot'?'selected':''}>Location Pin</option>
            <option value="fa-map-pin"      ${mi==='fa-map-pin'?'selected':''}>Map Pin</option>
            <option value="fa-compass"      ${mi==='fa-compass'?'selected':''}>Compass</option>
            <option value="fa-flag"         ${mi==='fa-flag'?'selected':''}>Flag</option>
            <option value="fa-star"         ${mi==='fa-star'?'selected':''}>Star</option>
            <option value="fa-camera"       ${mi==='fa-camera'?'selected':''}>Camera</option>
            <option value="fa-heart"        ${mi==='fa-heart'?'selected':''}>Heart</option>
          </select>
        </div>
        <div class="setting-row"><span class="setting-label">Marker Size</span>
          <select onchange="setTripStyleProp('markerSize',this.value);renderCurrentTrip()" style="height:30px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 8px;font-size:12px">
            <option value="small"       ${ms==='small'?'selected':''}>Small (20px)</option>
            <option value="medium-small"${ms==='medium-small'?'selected':''}>Medium Small (24px)</option>
            <option value="medium"      ${ms==='medium'?'selected':''}>Medium (28px)</option>
            <option value="large"       ${ms==='large'?'selected':''}>Large (34px)</option>
            <option value="extra-large" ${ms==='extra-large'?'selected':''}>Extra Large (40px)</option>
          </select>
        </div>
      </div>
      <div class="info-card" style="margin-bottom:0">
        <div class="info-card-title">Visibility</div>
        <div class="setting-row"><span class="setting-label">Route Paths</span><button class="toggle on" id="ct-paths" onclick="this.classList.toggle('on');document.getElementById('tog-paths').className=this.className;renderCurrentTrip()"></button></div>
        <div class="setting-row"><span class="setting-label">Stop Markers</span><button class="toggle on" id="ct-markers" onclick="this.classList.toggle('on');document.getElementById('tog-markers').className=this.className;renderCurrentTrip()"></button></div>
        <div class="setting-row"><span class="setting-label">Flight Arcs</span><button class="toggle on" id="ct-flights" onclick="this.classList.toggle('on');document.getElementById('tog-flights').className=this.className;renderCurrentTrip()"></button></div>
        <div class="setting-row"><span class="setting-label">Animate Paths</span><button class="toggle off" id="ct-animate" onclick="this.classList.toggle('on');document.getElementById('tog-animate').className=this.className;renderCurrentTrip()"></button></div>
      </div>
      <div class="info-card">
        <div class="info-card-title">Reset</div>
        <button class="btn sm ghost" onclick="resetHidden()"><i class="fa-solid fa-eye"></i> Show All Hidden</button>
        <button class="btn sm ghost" onclick="resetTripStyle()" style="margin-left:6px;"><i class="fa-solid fa-rotate-left"></i> Reset Style</button>
      </div>
    `;
  }
}

// Write a style property to the current trip and re-render
function setTripStyleProp(key, value) {
  if (!currentTrip) return;
  if (!currentTrip.style) currentTrip.style = {};
  currentTrip.style[key] = value;
}

// Reset trip style to global defaults
function resetTripStyle() {
  if (!currentTrip) return;
  currentTrip.style = {};
  renderCurrentTrip();
  renderSidePanel('customize');
}


function resetHidden() {
  if (!currentTrip) return;
  currentTrip.visits.forEach(v => v.hidden = false);
  currentTrip.activities.forEach(a => a.hidden = false);
  currentTrip.paths.forEach(p => p.hidden = false);
  renderCurrentTrip();
  showToast('All elements visible', 'success');
}

function openRenameModal(idx) {
  renamingTripIdx = idx;
  document.getElementById('rename-input').value = allTrips[idx].name;
  openModal('rename-modal');
  setTimeout(() => document.getElementById('rename-input').focus(), 100);
}

function renameCurrentTrip() {
  if (currentTripIdx >= 0) openRenameModal(currentTripIdx);
}

function confirmRename() {
  const name = document.getElementById('rename-input').value.trim();
  if (!name) { showToast('Name cannot be empty', 'error'); return; }
  if (renamingTripIdx >= 0) {
    const trip = allTrips[renamingTripIdx];
    trip.name = name;
    
    let cr = customTripRanges.find(r => r.id === trip.id);
    if (cr) {
      cr.name = name;
    } else {
      customTripRanges.push({
        id: trip.id,
        name: name,
        start: trip.start,
        end: trip.end
      });
    }
    
    if (currentTripIdx === renamingTripIdx) {
      document.getElementById('sp-trip-name').textContent = name;
      currentTrip.name = name;
    }
    renderTripGrid();
    closeModal('rename-modal');
    showToast('Trip renamed', 'success');
  }
}

function openEditTripModal() {
  if (!currentTrip) return;
  document.getElementById('edit-trip-start').value = toLocalISOString(currentTrip.start);
  document.getElementById('edit-trip-end').value = toLocalISOString(currentTrip.end);
  openModal('edit-trip-modal');
}

function confirmEditTrip() {
  if (!currentTrip) return;
  const startVal = document.getElementById('edit-trip-start').value;
  const endVal = document.getElementById('edit-trip-end').value;
  if (!startVal || !endVal) { showToast('Dates cannot be empty', 'error'); return; }
  
  const startTs = new Date(startVal).getTime();
  const endTs = new Date(endVal).getTime();
  if (isNaN(startTs) || isNaN(endTs)) { showToast('Invalid dates', 'error'); return; }
  if (endTs <= startTs) { showToast('End date must be after start date', 'error'); return; }
  
  let cr = customTripRanges.find(r => r.id === currentTrip.id);
  if (cr) {
    cr.start = startTs;
    cr.end = endTs;
  } else {
    customTripRanges.push({
      id: currentTrip.id,
      name: currentTrip.name,
      start: startTs,
      end: endTs
    });
  }
  
  buildTrips();
  applyFilters();
  closeModal('edit-trip-modal');
  refreshCurrentTripView();
  showToast('Trip date range updated', 'success');
}

function deleteTrip(idx) {
  const t = allTrips[idx];
  if (!confirm(`Delete "${t.name}" and all of its associated stops/paths?`)) return;
  
  // Clean up associated child events from main tables
  allVisits = allVisits.filter(v => !t.visits.includes(v));
  allActivities = allActivities.filter(a => !t.activities.includes(a));
  allPaths = allPaths.filter(p => !t.paths.includes(p));
  
  allTrips.splice(idx, 1);
  if (currentTripIdx === idx) {
    closeSidePanel();
  } else if (currentTripIdx > idx) {
    currentTripIdx--;
  }
  applyFilters();
  showToast('Trip deleted and data cleaned up', 'success');
}

function openMergeModal() {
  if (allTrips.length < 2) { showToast('Need at least 2 trips to merge', 'warning'); return; }
  mergeSelected = [];
  const list = document.getElementById('merge-trip-list');
  list.innerHTML = allTrips.map((t, i) => `
    <div class="merge-trip-option" id="merge-opt-${i}" onclick="toggleMergeSelect(${i})">
      <input type="checkbox" id="mc-${i}"> ${t.name} <span style="color:var(--text2);font-size:11px">(${fmtDate(t.start)})</span>
    </div>
  `).join('');
  openModal('merge-modal');
}

function toggleMergeSelect(idx) {
  const opt = document.getElementById(`merge-opt-${idx}`);
  const cb = document.getElementById(`mc-${idx}`);
  const pos = mergeSelected.indexOf(idx);
  if (pos > -1) {
    mergeSelected.splice(pos, 1);
    opt.classList.remove('selected');
    cb.checked = false;
  } else if (mergeSelected.length < 2) {
    mergeSelected.push(idx);
    opt.classList.add('selected');
    cb.checked = true;
  } else {
    showToast('Select exactly 2 trips', 'warning');
  }
}

function confirmMerge() {
  if (mergeSelected.length !== 2) { showToast('Select exactly 2 trips', 'warning'); return; }
  const [a, b] = mergeSelected.sort((x, y) => x - y);
  const ta = allTrips[a], tb = allTrips[b];
  const merged = {
    name: `${ta.name} + ${tb.name.split('—')[0].trim()}`,
    start: Math.min(ta.start, tb.start), end: Math.max(ta.end, tb.end),
    durationDays: (Math.max(ta.end, tb.end) - Math.min(ta.start, tb.start)) / 86400000,
    visits: [...ta.visits, ...tb.visits].sort((x, y) => x.startTime - y.startTime),
    activities: [...ta.activities, ...tb.activities].sort((x, y) => x.startTime - y.startTime),
    paths: [...ta.paths, ...tb.paths].sort((x, y) => x.startTime - y.startTime),
    modes: [...new Set([...ta.modes, ...tb.modes])],
    region: ta.region || tb.region,
    bbox: null, monthYear: getMonthYear(Math.min(ta.start, tb.start)),
    hidden: false
  };
  // Merge bbox
  const all = [ta, tb].filter(t => t.bbox);
  if (all.length) {
    merged.bbox = {
      south: Math.min(...all.map(t => t.bbox.south)),
      north: Math.max(...all.map(t => t.bbox.north)),
      west: Math.min(...all.map(t => t.bbox.west)),
      east: Math.max(...all.map(t => t.bbox.east))
    };
  }
  allTrips.splice(b, 1);
  allTrips.splice(a, 1, merged);
  applyFilters();
  closeModal('merge-modal');
  showToast(`Merged into "${merged.name}"`, 'success');
}

function changeClusterCriterion(val) {
  if (val === 'none') {
    SETTINGS.clusterMode = false;
  } else {
    SETTINGS.clusterMode = true;
    SETTINGS.clusterCriterion = val;
  }
  renderTripGrid();
}

function openAdvanced() {
  document.getElementById('advanced-panel').classList.add('open');
  renderAdvPanel('trips-data');
}

function closeAdvanced() {
  document.getElementById('advanced-panel').classList.remove('open');
}

function switchAdvTab(btn, tab) {
  document.querySelectorAll('.adv-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentAdvTab = tab;
  renderAdvPanel(tab);
}

function renderAdvPanel(tab) {
  const body = document.getElementById('adv-body');
  if (tab === 'trips-data') {
    body.innerHTML = `<table class="data-table">
      <thead><tr><th>#</th><th>Name</th><th>Start</th><th>End</th><th>Days</th><th>Visits</th><th>Activities</th><th>Paths</th><th>Modes</th><th>Region</th><th>Actions</th></tr></thead>
      <tbody>${allTrips.map((t, i) => `<tr>
        <td>${i + 1}</td>
        <td><button class="btn sm ghost" onclick="editTripName(${i})">${t.name}</button></td>
        <td><code>${fmtDate(t.start)}</code></td>
        <td><code>${fmtDate(t.end)}</code></td>
        <td>${t.durationDays.toFixed(1)}</td>
        <td>${t.visits.length}</td>
        <td>${t.activities.length}</td>
        <td>${t.paths.length}</td>
        <td>${t.modes.join(', ')}</td>
        <td>${t.region || '--'}</td>
        <td>
          <button class="btn sm ghost" onclick="deleteTrip(${i})" style="color:var(--accent2)" title="Delete Trip"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`).join('')}</tbody>
    </table>`;
  } else if (tab === 'visits-data') {
    body.innerHTML = `
      <div style="margin-bottom:12px;"><button class="btn sm accent" onclick="openDbEdit('visit', -1)"><i class="fa-solid fa-plus"></i> Add Stop</button></div>
      <table class="data-table">
        <thead><tr><th>#</th><th>Start</th><th>Duration</th><th>Lat</th><th>Lng</th><th>Type</th><th>Purpose</th><th>Time of Day</th><th>Region</th><th>Prob</th><th>Actions</th></tr></thead>
        <tbody>${allVisits.map((v, i) => `<tr>
          <td>${i + 1}</td>
          <td><code>${fmtDateTime(v.startTime)}</code></td>
          <td>${fmtDuration(v.duration)}</td>
          <td><code>${v.lat.toFixed(5)}</code></td>
          <td><code>${v.lng.toFixed(5)}</code></td>
          <td>${v.semanticType}</td>
          <td>${v.purpose}</td>
          <td>${v.timeOfDay}</td>
          <td>${v.region || '--'}</td>
          <td>${(v.probability * 100).toFixed(0)}%</td>
          <td>
            <div style="display:flex;gap:4px;">
              <button class="btn sm ghost" onclick="openDbEdit('visit', ${i})"><i class="fa-solid fa-pen"></i></button>
              <button class="btn sm ghost" onclick="deleteDbRecord('visit', ${i})" style="color:var(--accent2)"><i class="fa-solid fa-trash"></i></button>
            </div>
          </td>
        </tr>`).join('')}</tbody>
      </table>`;
  } else if (tab === 'activities-data') {
    body.innerHTML = `
      <div style="margin-bottom:12px;"><button class="btn sm accent" onclick="openDbEdit('activity', -1)"><i class="fa-solid fa-plus"></i> Add Activity</button></div>
      <table class="data-table">
        <thead><tr><th>#</th><th>Start</th><th>Duration</th><th>From</th><th>To</th><th>Distance</th><th>Mode</th><th>Prob</th><th>Actions</th></tr></thead>
        <tbody>${allActivities.map((a, i) => {
          const mode = estimateTravelMode(a.distanceM || 0, a.duration);
          return `<tr>
            <td>${i + 1}</td>
            <td><code>${fmtDateTime(a.startTime)}</code></td>
            <td>${fmtDuration(a.duration)}</td>
            <td><code>${a.startLat?.toFixed(4) || '--'}, ${a.startLng?.toFixed(4) || '--'}</code></td>
            <td><code>${a.endLat?.toFixed(4) || '--'}, ${a.endLng?.toFixed(4) || '--'}</code></td>
            <td>${a.distanceM ? (a.distanceM / 1000).toFixed(1) + 'km' : '--'}</td>
            <td>${mode}</td>
            <td>${(a.probability * 100).toFixed(0)}%</td>
            <td>
              <div style="display:flex;gap:4px;">
                <button class="btn sm ghost" onclick="openDbEdit('activity', ${i})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn sm ghost" onclick="deleteDbRecord('activity', ${i})" style="color:var(--accent2)"><i class="fa-solid fa-trash"></i></button>
              </div>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  } else if (tab === 'paths-data') {
    body.innerHTML = `
      <div style="margin-bottom:12px;"><button class="btn sm accent" onclick="openDbEdit('path', -1)"><i class="fa-solid fa-plus"></i> Add Path</button></div>
      <table class="data-table">
        <thead><tr><th>#</th><th>Start</th><th>End</th><th>Duration</th><th>Points</th><th>Start Point</th><th>Actions</th></tr></thead>
        <tbody>${allPaths.map((p, i) => `<tr>
          <td>${i + 1}</td>
          <td><code>${fmtDateTime(p.startTime)}</code></td>
          <td><code>${fmtDateTime(p.endTime)}</code></td>
          <td>${fmtDuration(p.endTime - p.startTime)}</td>
          <td>${p.points.length}</td>
          <td><code>${p.points[0]?.lat.toFixed(4)}, ${p.points[0]?.lng.toFixed(4)}</code></td>
          <td>
            <div style="display:flex;gap:4px;">
              <button class="btn sm ghost" onclick="openDbEdit('path', ${i})"><i class="fa-solid fa-pen"></i></button>
              <button class="btn sm ghost" onclick="deleteDbRecord('path', ${i})" style="color:var(--accent2)"><i class="fa-solid fa-trash"></i></button>
            </div>
          </td>
        </tr>`).join('')}</tbody>
      </table>`;
  } else if (tab === 'raw-data') {
    body.innerHTML = `<div style="font-size:11px;color:var(--text2);margin-bottom:8px;">${rawData.length} raw records</div>
    <pre style="font-size:11px;color:var(--text2);background:var(--surface2);padding:16px;border-radius:8px;overflow:auto;max-height:600px;white-space:pre-wrap;word-break:break-all">${JSON.stringify(rawData.slice(0, 20), null, 2)}${rawData.length > 20 ? `\n\n... and ${rawData.length - 20} more records` : ''}</pre>`;
  }
}

function editTripName(idx) {
  openRenameModal(idx);
}

function openDbEdit(type, index) {
  currentDbEditType = type;
  currentDbEditIndex = index;
  
  const body = document.getElementById('db-edit-body');
  const title = document.getElementById('db-edit-title');
  const saveBtn = document.getElementById('db-edit-save-btn');
  
  if (index === -1) {
    title.textContent = `Add New ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  } else {
    title.textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  }
  
  let html = '';
  
  if (type === 'visit') {
    const v = index >= 0 ? allVisits[index] : {
      semanticType: '', purpose: 'visit', startTime: Date.now(), endTime: Date.now() + 3600000,
      lat: 0.0, lng: 0.0, region: '', probability: 1.0, customColor: '#4fffb0'
    };
    
    html = `
      <div class="filter-group" style="margin-bottom:12px;">
        <label>Name / Place Type</label>
        <input type="text" id="db-v-type" value="${v.semanticType || ''}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
      </div>
      <div class="filter-group" style="margin-bottom:12px;">
        <label>Purpose</label>
        <select id="db-v-purpose" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
          <option value="visit" ${v.purpose === 'visit' ? 'selected' : ''}>Short Visit</option>
          <option value="overnight stay" ${v.purpose === 'overnight stay' ? 'selected' : ''}>Overnight Stay</option>
          <option value="full day" ${v.purpose === 'full day' ? 'selected' : ''}>Full Day Stop</option>
        </select>
      </div>
      <div class="filter-group" style="margin-bottom:12px;">
        <label>Start Time</label>
        <input type="datetime-local" id="db-v-start" value="${toLocalISOString(v.startTime)}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
      </div>
      <div class="filter-group" style="margin-bottom:12px;">
        <label>End Time</label>
        <input type="datetime-local" id="db-v-end" value="${toLocalISOString(v.endTime)}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
      </div>
      <div style="display:flex;gap:12px;margin-bottom:12px;">
        <div class="filter-group" style="flex:1;">
          <label>Latitude</label>
          <input type="number" step="any" id="db-v-lat" value="${v.lat}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
        </div>
        <div class="filter-group" style="flex:1;">
          <label>Longitude</label>
          <input type="number" step="any" id="db-v-lng" value="${v.lng}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
        </div>
      </div>
      <div class="filter-group" style="margin-bottom:12px;">
        <label>Region</label>
        <input type="text" id="db-v-region" value="${v.region || ''}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
      </div>
      <div class="filter-group" style="margin-bottom:12px;">
        <label>Marker Color</label>
        <select id="db-v-color" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
          <option value="#4fffb0" ${v.customColor === '#4fffb0' ? 'selected' : ''}>Green (Default)</option>
          <option value="#ffd166" ${v.customColor === '#ffd166' ? 'selected' : ''}>Yellow (Hotel/Stay)</option>
          <option value="#ff6b6b" ${v.customColor === '#ff6b6b' ? 'selected' : ''}>Red</option>
          <option value="#74b9ff" ${v.customColor === '#74b9ff' ? 'selected' : ''}>Blue</option>
          <option value="#a29bfe" ${v.customColor === '#a29bfe' ? 'selected' : ''}>Purple</option>
        </select>
      </div>
      <div class="filter-group" style="margin-bottom:12px;">
        <label>Probability (0-1)</label>
        <input type="number" step="0.01" min="0" max="1" id="db-v-prob" value="${v.probability || 1.0}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
      </div>
    `;
  } else if (type === 'activity') {
    const a = index >= 0 ? allActivities[index] : {
      mode: 'car', distanceM: 1000, startTime: Date.now(), endTime: Date.now() + 600000,
      startLat: 0.0, startLng: 0.0, endLat: 0.0, endLng: 0.0, probability: 1.0
    };
    
    html = `
      <div class="filter-group" style="margin-bottom:12px;">
        <label>Mode</label>
        <select id="db-a-mode" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
          <option value="car" ${a.mode === 'car' ? 'selected' : ''}>Car</option>
          <option value="flight" ${a.mode === 'flight' ? 'selected' : ''}>Flight</option>
          <option value="train" ${a.mode === 'train' ? 'selected' : ''}>Train</option>
          <option value="walking" ${a.mode === 'walking' ? 'selected' : ''}>Walking</option>
          <option value="cycling" ${a.mode === 'cycling' ? 'selected' : ''}>Cycling</option>
        </select>
      </div>
      <div class="filter-group" style="margin-bottom:12px;">
        <label>Distance (meters)</label>
        <input type="number" id="db-a-dist" value="${a.distanceM || 0}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
      </div>
      <div class="filter-group" style="margin-bottom:12px;">
        <label>Start Time</label>
        <input type="datetime-local" id="db-a-start" value="${toLocalISOString(a.startTime)}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
      </div>
      <div class="filter-group" style="margin-bottom:12px;">
        <label>End Time</label>
        <input type="datetime-local" id="db-a-end" value="${toLocalISOString(a.endTime)}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
      </div>
      <div style="display:flex;gap:12px;margin-bottom:12px;">
        <div class="filter-group" style="flex:1;">
          <label>Start Latitude</label>
          <input type="number" step="any" id="db-a-slat" value="${a.startLat || ''}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
        </div>
        <div class="filter-group" style="flex:1;">
          <label>Start Longitude</label>
          <input type="number" step="any" id="db-a-slng" value="${a.startLng || ''}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
        </div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:12px;">
        <div class="filter-group" style="flex:1;">
          <label>End Latitude</label>
          <input type="number" step="any" id="db-a-elat" value="${a.endLat || ''}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
        </div>
        <div class="filter-group" style="flex:1;">
          <label>End Longitude</label>
          <input type="number" step="any" id="db-a-elng" value="${a.endLng || ''}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
        </div>
      </div>
      <div class="filter-group" style="margin-bottom:12px;">
        <label>Probability (0-1)</label>
        <input type="number" step="0.01" min="0" max="1" id="db-a-prob" value="${a.probability || 1.0}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
      </div>
    `;
  } else if (type === 'path') {
    const p = index >= 0 ? allPaths[index] : {
      startTime: Date.now(), endTime: Date.now() + 1800000, points: []
    };
    
    const ptsStr = p.points.map(pt => `${pt.lat},${pt.lng},${pt.offsetMin}`).join('\n');
    
    html = `
      <div class="filter-group" style="margin-bottom:12px;">
        <label>Start Time</label>
        <input type="datetime-local" id="db-p-start" value="${toLocalISOString(p.startTime)}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
      </div>
      <div class="filter-group" style="margin-bottom:12px;">
        <label>End Time</label>
        <input type="datetime-local" id="db-p-end" value="${toLocalISOString(p.endTime)}" class="db-input" style="width:100%;height:34px;border-radius:6px;border:1px solid var(--border2);background:var(--surface2);color:var(--text);padding:0 10px;font-size:13px;">
      </div>
      <div class="filter-group" style="margin-bottom:12px;">
        <label>Points List (Format: latitude,longitude,offsetMinutes - one per line)</label>
        <textarea id="db-p-points" rows="8" style="width:100%;background:var(--surface2);border:1px solid var(--border2);color:var(--text);border-radius:6px;padding:8px;font-family:monospace;font-size:12px;resize:vertical;" placeholder="e.g. 48.8566,2.3522,0\n48.8570,2.3530,5">${ptsStr}</textarea>
      </div>
    `;
  }
  
  body.innerHTML = html;
  saveBtn.onclick = () => saveDbEdit();
  openModal('db-edit-modal');
}

function saveDbEdit() {
  const type = currentDbEditType;
  const index = currentDbEditIndex;
  
  if (type === 'visit') {
    const semanticType = document.getElementById('db-v-type').value.trim() || 'Visit';
    const purpose = document.getElementById('db-v-purpose').value;
    const startTime = new Date(document.getElementById('db-v-start').value).getTime();
    const endTime = new Date(document.getElementById('db-v-end').value).getTime();
    const lat = parseFloat(document.getElementById('db-v-lat').value) || 0;
    const lng = parseFloat(document.getElementById('db-v-lng').value) || 0;
    const region = document.getElementById('db-v-region').value.trim() || null;
    const customColor = document.getElementById('db-v-color').value;
    const probability = parseFloat(document.getElementById('db-v-prob').value) || 1.0;
    
    if (isNaN(startTime) || isNaN(endTime)) { showToast('Invalid dates', 'error'); return; }
    if (endTime < startTime) { showToast('End time must be after start time', 'error'); return; }
    
    const visitData = {
      startTime, endTime, duration: endTime - startTime, lat, lng,
      semanticType, purpose, timeOfDay: getTimeOfDay(new Date(startTime).getUTCHours()),
      region, customColor, probability, hidden: false
    };
    
    if (index === -1) {
      allVisits.push(visitData);
      showToast('Stop added', 'success');
    } else {
      allVisits[index] = Object.assign(allVisits[index], visitData);
      showToast('Stop updated', 'success');
    }
  } else if (type === 'activity') {
    const mode = document.getElementById('db-a-mode').value;
    const distanceM = parseFloat(document.getElementById('db-a-dist').value) || 0;
    const startTime = new Date(document.getElementById('db-a-start').value).getTime();
    const endTime = new Date(document.getElementById('db-a-end').value).getTime();
    const startLat = parseFloat(document.getElementById('db-a-slat').value) || null;
    const startLng = parseFloat(document.getElementById('db-a-slng').value) || null;
    const endLat = parseFloat(document.getElementById('db-a-elat').value) || null;
    const endLng = parseFloat(document.getElementById('db-a-elng').value) || null;
    const probability = parseFloat(document.getElementById('db-a-prob').value) || 1.0;
    
    if (isNaN(startTime) || isNaN(endTime)) { showToast('Invalid dates', 'error'); return; }
    if (endTime < startTime) { showToast('End time must be after start time', 'error'); return; }
    
    const activityData = {
      mode, distanceM, startTime, endTime, duration: endTime - startTime,
      startLat, startLng, endLat, endLng, probability, hidden: false
    };
    
    if (index === -1) {
      allActivities.push(activityData);
      showToast('Activity added', 'success');
    } else {
      allActivities[index] = Object.assign(allActivities[index], activityData);
      showToast('Activity updated', 'success');
    }
  } else if (type === 'path') {
    const startTime = new Date(document.getElementById('db-p-start').value).getTime();
    const endTime = new Date(document.getElementById('db-p-end').value).getTime();
    const ptsText = document.getElementById('db-p-points').value.trim();
    
    if (isNaN(startTime) || isNaN(endTime)) { showToast('Invalid dates', 'error'); return; }
    if (endTime < startTime) { showToast('End time must be after start time', 'error'); return; }
    
    const points = ptsText.split('\n').map(line => {
      const parts = line.split(',');
      if (parts.length < 3) return null;
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      const offsetMin = parseFloat(parts[2]);
      if (isNaN(lat) || isNaN(lng) || isNaN(offsetMin)) return null;
      return { lat, lng, offsetMin };
    }).filter(Boolean);
    
    const pathData = { startTime, endTime, points, hidden: false };
    
    if (index === -1) {
      allPaths.push(pathData);
      showToast('Path added', 'success');
    } else {
      allPaths[index] = Object.assign(allPaths[index], pathData);
      showToast('Path updated', 'success');
    }
  }
  
  buildTrips();
  applyFilters();
  renderAdvPanel(currentAdvTab);
  closeModal('db-edit-modal');
  refreshCurrentTripView();
}

function deleteDbRecord(type, index) {
  if (!confirm(`Delete this ${type}?`)) return;
  if (type === 'visit') {
    allVisits.splice(index, 1);
  } else if (type === 'activity') {
    allActivities.splice(index, 1);
  } else if (type === 'path') {
    allPaths.splice(index, 1);
  }
  
  buildTrips();
  applyFilters();
  renderAdvPanel(currentAdvTab);
  showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted`, 'success');
  refreshCurrentTripView();
}

function toggleSettings() {
  const p = document.getElementById('settings-panel');
  const btn = document.getElementById('btn-settings');
  p.classList.toggle('open');
  btn.classList.toggle('active');
}

function clearAllData() {
  if (!confirm('Clear ALL uploaded data? This cannot be undone.')) return;
  rawData = []; allVisits = []; allActivities = []; allPaths = []; allTrips = []; filteredTrips = [];
  clearMapLayers(); closeSidePanel();
  renderTripGrid();
  showToast('All data cleared', 'info');
}

function openShareTrip() {
  shareTarget = currentTripIdx;
  document.getElementById('share-modal-title').textContent = currentTrip ? currentTrip.name : 'Trip';
  document.getElementById('share-status').style.display = 'none';
  openModal('share-modal');
}

function openShareAll() {
  if (!allTrips.length) { showToast('No trips to share yet', 'warning'); return; }
  shareTarget = 'all';
  document.getElementById('share-modal-title').textContent = 'All Trips';
  document.getElementById('share-status').style.display = 'none';
  openModal('share-modal');
}

function toggleBasemapPicker() {
  document.getElementById('basemap-picker').classList.toggle('open');
  document.getElementById('ctrl-basemap').classList.toggle('active');
}
