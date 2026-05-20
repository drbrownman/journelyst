// ============================================================
//  JOURNELYST UNIT TEST SUITE
// ============================================================

const tests = [];
function addTest(name, description, fn) {
  tests.push({ name, description, fn });
}

// 1. DURATION FORMATTING TEST
addTest('fmtDuration', 'Formats durations into human readable strings.', () => {
  // Test case 1: under a minute
  assert(fmtDuration(45 * 1000) === '45s', '45 seconds formatting');
  
  // Test case 2: minutes and seconds
  assert(fmtDuration(5 * 60 * 1000 + 12 * 1000) === '5m 12s', '5m 12s formatting');
  
  // Test case 3: hours and minutes
  assert(fmtDuration(3 * 3600 * 1000 + 45 * 60 * 1000) === '3h 45m', '3h 45m formatting');
  
  // Test case 4: days
  assert(fmtDuration(2.5 * 24 * 3600 * 1000) === '2d 12h', '2d 12h formatting');
});

// 2. HAVERSINE DISTANCE TEST
addTest('haversineKm', 'Calculates accurate spherical distance between coordinates.', () => {
  const distZero = haversineKm(30.2672, -97.7431, 30.2672, -97.7431);
  assert(Math.abs(distZero) < 0.0001, 'Same point distance should be zero');
  
  // Austin to New York City (~2430 km)
  const distAustinNyc = haversineKm(30.2672, -97.7431, 40.7128, -74.0060);
  assert(distAustinNyc > 2400 && distAustinNyc < 2500, `Austin to NYC should be ~2430km. Calculated: ${distAustinNyc}`);
});

// 3. TRAVEL MODE ESTIMATION TEST
addTest('estimateTravelMode', 'Guesses travel mode based on distance and duration.', () => {
  // 100 meters in 1 minute (~6 km/h) -> walking
  assert(estimateTravelMode(100, 60 * 1000) === 'walking', '100m in 1m should be walking');
  
  // 20 km in 20 minutes (~60 km/h) -> car
  assert(estimateTravelMode(20000, 20 * 60 * 1000) === 'car', '20km in 20m should be car');
  
  // 1000 km in 2 hours (~500 km/h) -> flight
  assert(estimateTravelMode(1000000, 2 * 3600 * 1000) === 'flight', '1000km in 2h should be flight');
});

// 4. REGION RESOLUTION TEST
addTest('getRegionForPoint', 'Resolves location region from coordinates and CSV database bounds.', () => {
  // Clear and populate mock region
  REGIONS.length = 0;
  REGIONS.push({
    name: 'Texas, USA',
    country: 'USA',
    region: 'Texas',
    bbox: [25.837, -106.646, 36.500, -93.508] // [south, west, north, east]
  });
  
  const regionInside = getRegionForPoint(30.2672, -97.7431); // Austin
  assert(regionInside !== null && regionInside.name === 'Texas, USA', 'Austin should be resolved inside Texas');
  
  const regionOutside = getRegionForPoint(48.8566, 2.3522); // Paris
  assert(regionOutside === null, 'Paris should not be resolved inside Texas');
});

// 5. TRIP CLUSTERING & GROUPING TEST
addTest('tripBuilding', 'Concurrently groups visits and segments them into discrete trips.', () => {
  // Setup mock raw data
  rawData = [];
  const baseTime = Date.now();
  const dayMs = 86400000;
  
  // Trip 1: Austin (2 visits and 1 activity)
  rawData.push({
    startTime: new Date(baseTime).toISOString(),
    endTime: new Date(baseTime + 2 * 3600000).toISOString(),
    visit: { topCandidate: { probability: '0.9', semanticType: 'Restaurant', placeID: 'v1', placeLocation: 'geo:30.2672,-97.7431' }, probability: '0.9' }
  });
  rawData.push({
    startTime: new Date(baseTime + 2 * 3600000).toISOString(),
    endTime: new Date(baseTime + 3 * 3600000).toISOString(),
    activity: { probability: '0.8', start: 'geo:30.2672,-97.7431', end: 'geo:30.3072,-97.7531', topCandidate: { type: 'in passenger vehicle', probability: '0.8' }, distanceMeters: '6000' }
  });
  rawData.push({
    startTime: new Date(baseTime + 3 * 3600000).toISOString(),
    endTime: new Date(baseTime + 10 * 3600000).toISOString(),
    visit: { topCandidate: { probability: '0.85', semanticType: 'Hotel', placeID: 'v2', placeLocation: 'geo:30.3072,-97.7531' }, probability: '0.85' }
  });
  
  // 3-day gap -> creates a boundary for Trip 2
  const trip2Start = baseTime + 4 * dayMs;
  
  // Trip 2: Dallas
  rawData.push({
    startTime: new Date(trip2Start).toISOString(),
    endTime: new Date(trip2Start + 4 * 3600000).toISOString(),
    visit: { topCandidate: { probability: '0.88', semanticType: 'Museum', placeID: 'v3', placeLocation: 'geo:32.7767,-96.7970' }, probability: '0.88' }
  });
  
  // Process the data
  preprocessData();
  
  // Assertions
  assert(allVisits.length === 3, `Should extract exactly 3 visits. Found: ${allVisits.length}`);
  assert(allActivities.length === 1, `Should extract exactly 1 activity. Found: ${allActivities.length}`);
  assert(allTrips.length === 2, `Should build exactly 2 separate trips due to the 4-day gap. Found: ${allTrips.length}`);
  
  // Validate details
  assert(allTrips[0].visits.length === 2, 'First trip should have 2 visits');
  assert(allTrips[1].visits.length === 1, 'Second trip should have 1 visit');
});

// ASSERTION HELPER
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// RUNNER FUNCTION
window.onload = function() {
  const container = document.getElementById('test-list');
  const badge = document.getElementById('summary-badge');
  let passedCount = 0;
  
  tests.forEach((test, idx) => {
    const card = document.createElement('div');
    card.className = 'test-card';
    
    const info = document.createElement('div');
    info.className = 'test-info';
    info.innerHTML = `
      <div class="test-name">${idx + 1}. ${test.name}</div>
      <div class="test-desc">${test.description}</div>
    `;
    card.appendChild(info);
    
    const status = document.createElement('div');
    
    try {
      test.fn();
      status.className = 'test-status pass';
      status.innerHTML = '<i class="fa-solid fa-circle-check"></i> PASS';
      passedCount++;
    } catch (err) {
      status.className = 'test-status fail';
      status.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> FAIL';
      
      const errorLog = document.createElement('div');
      errorLog.className = 'error-log';
      errorLog.textContent = `Assertion Error: ${err.message}\n${err.stack}`;
      
      // Wrap card to append error log below it
      const wrapper = document.createElement('div');
      wrapper.style.marginBottom = '12px';
      card.style.marginBottom = '0';
      
      wrapper.appendChild(card);
      wrapper.appendChild(errorLog);
      container.appendChild(wrapper);
      return;
    }
    
    card.appendChild(status);
    container.appendChild(card);
  });
  
  badge.textContent = `${passedCount} / ${tests.length} passed`;
  badge.style.borderColor = passedCount === tests.length ? 'var(--accent-pass)' : 'var(--accent-fail)';
  badge.style.color = passedCount === tests.length ? 'var(--accent-pass)' : 'var(--accent-fail)';
};
