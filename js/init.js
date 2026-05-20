// ============================================================
//  APPLICATION INITIALIZATION & MAP GLOBAL LISTENERS
// ============================================================

// Initialize Map
initMap();

// Close panels on map click
document.getElementById('map').addEventListener('click', () => {
  const picker = document.getElementById('basemap-picker');
  const ctrl = document.getElementById('ctrl-basemap');
  if (picker) picker.classList.remove('open');
  if (ctrl) ctrl.classList.remove('active');
});



// Initial Ingestion Sequence
loadRegionsCSV().then(() => {
  renderTripGrid();
});
