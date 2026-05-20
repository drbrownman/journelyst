// ============================================================
//  UTILITY FUNCTIONS & HELPERS
// ============================================================

function parseGeo(geoStr) {
  if (!geoStr) return null;
  const m = geoStr.match(/geo:([-\d.]+),([-\d.]+)/);
  if (!m) return null;
  return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
}

function parseTime(str) {
  try { return new Date(str).getTime(); } catch { return 0; }
}

function fmtDate(ts) {
  if (!ts) return '--';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(ts) {
  if (!ts) return '--';
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h/24)}d ${h%24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
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
  return `${month} ${day}, ${year} ${hours}:${minutes} ${ampm}`;
}

function toLocalISOString(ts) {
  const date = new Date(ts);
  const pad = (num) => (num < 10 ? '0' : '') + num;
  return date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes());
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

  const phi1 = lat1 * toRad;
  const lambda1 = lng1 * toRad;
  const phi2 = lat2 * toRad;
  const lambda2 = lng2 * toRad;

  // Angular distance
  const sinDPhi = Math.sin((phi2 - phi1) / 2);
  const sinDLambda = Math.sin((lambda2 - lambda1) / 2);
  const a = sinDPhi * sinDPhi + Math.cos(phi1) * Math.cos(phi2) * sinDLambda * sinDLambda;
  const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  if (d < 0.000001) {
    return [[lat1, lng1]];
  }

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

  // Ensure continuous longitudes to prevent Date Line wrapping visual glitch in Leaflet
  for (let i = 1; i < points.length; i++) {
    const prevLng = points[i-1][1];
    let currLng = points[i][1];
    if (currLng - prevLng > 180) {
      currLng -= 360;
    } else if (currLng - prevLng < -180) {
      currLng += 360;
    }
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

function getTimeOfDay(hour) {
  if (hour < 5) return 'late night';
  if (hour < 9) return 'early morning';
  if (hour < 12) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 18) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

function getVisitPurpose(durationMs) {
  const h = durationMs / 3600000;
  if (h < 0.25) return 'quick stop';
  if (h < 2) return 'brief visit';
  if (h < 6) return 'couple hours';
  if (h < 12) return 'half day';
  if (h < 20) return 'full day';
  return 'overnight stay';
}

function getMonthYear(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getModeIcon(mode) {
  const icons = { flight:'fa-plane', train:'fa-train', car:'fa-car', bike:'fa-bicycle', walking:'fa-person-walking', 'in passenger vehicle':'fa-car', subway:'fa-subway', cycling:'fa-bicycle' };
  return icons[mode] || 'fa-location-dot';
}

function getModeColor(mode) {
  const colors = { flight: '#74b9ff', train: '#ffd166', car: '#4fffb0', bike: '#a29bfe', walking: '#fd79a8', subway: '#00cec9' };
  return colors[mode] || SETTINGS.pathColor;
}

function showToast(msg, type='info', duration=4000) {
  const icons = { info:'fa-circle-info', success:'fa-circle-check', error:'fa-circle-exclamation', warning:'fa-triangle-exclamation' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fa-solid ${icons[type]||icons.info}"></i><span class="toast-msg">${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transform='translateY(12px)'; el.style.transition='0.3s'; setTimeout(()=>el.remove(), 300); }, duration);
}

// ============================================================
//  MODAL HELPERS
// ============================================================
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function toggleExpand(id) {
  const el = document.getElementById(id);
  el.classList.toggle('open');
}
