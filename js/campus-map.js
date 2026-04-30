/**
 * js/campus-map.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive Campus Map for COMSATS Islamabad using Leaflet.js.
 * Handles: map init, markers, search, filtering, and coordinate capture.
 */

document.addEventListener('DOMContentLoaded', () => {
    const mapCenter = [33.6518, 73.1566];
    const mapZoom = 17;

    // 1. Initialize Map
    const map = L.map('map', {
        zoomControl: false, // We'll add it in a better position
        attributionControl: true
    }).setView(mapCenter, mapZoom);

    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    // 2. Add Tiles
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // 3. Define Places Data
    const campusPlaces = [
        { id: 1, name: "Junaid Zaidi Library", category: "academic", coords: [33.65155, 73.15695], icon: "library_books", desc: "Main university library and study center." },
        { id: 2, name: "Admin Block", category: "admin", coords: [33.65108, 73.15545], icon: "account_balance", desc: "Main administrative offices and registrar." },
        { id: 3, name: "Gate 1 (Main)", category: "admin", coords: [33.65445, 73.15585], icon: "gate", desc: "Main entrance to the university campus." },
        { id: 4, name: "Main Cafe", category: "food", coords: [33.65245, 73.15615], icon: "restaurant", desc: "Primary dining area and student hangout." },
        { id: 5, name: "Johar Hostel", category: "hostel", coords: [33.64955, 73.15785], icon: "bed", desc: "Boys hostel block." },
        { id: 6, name: "Iqbal Hostel", category: "hostel", coords: [33.64915, 73.15825], icon: "bed", desc: "Boys hostel block." },
        { id: 7, name: "Architecture Block", category: "academic", coords: [33.65315, 73.15525], icon: "architecture", desc: "Department of Architecture and Design." },
        { id: 8, name: "Business Admin (BBA)", category: "academic", coords: [33.65025, 73.15615], icon: "business_center", desc: "Department of Management Sciences." },
        { id: 9, name: "EE & CS Block", category: "academic", coords: [33.65215, 73.15785], icon: "computer", desc: "Electrical Engineering and Computer Science departments." },
        { id: 10, name: "Sports Complex", category: "academic", coords: [33.64855, 73.15655], icon: "sports_soccer", desc: "Cricket ground, basketball courts and gym." },
        { id: 11, name: "Faculty Cafe", category: "food", coords: [33.65125, 73.15655], icon: "coffee", desc: "Quiet cafe area for faculty and staff." },
        { id: 12, name: "Girls Hostel", category: "hostel", coords: [33.65385, 73.15425], icon: "female", desc: "On-campus girls residence." }
    ];

    // 4. Campus Boundary (Rough Polygon)
    const boundaryCoords = [
        [33.6548, 73.1550],
        [33.6548, 73.1568],
        [33.6530, 73.1595],
        [33.6480, 73.1595],
        [33.6475, 73.1565],
        [33.6480, 73.1540],
        [33.6500, 73.1530],
        [33.6540, 73.1530]
    ];
    const boundary = L.polygon(boundaryCoords, {
        color: '#0ea5e9',
        fillColor: '#0ea5e9',
        fillOpacity: 0.05,
        weight: 2,
        dashArray: '5, 10'
    }).addTo(map);

    // 5. Marker Logic
    const markersLayer = L.layerGroup().addTo(map);
    const markerInstances = {};

    function createMarker(place) {
        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `
                <div class="marker-container" style="background: ${getCategoryColor(place.category)}">
                    <span class="material-symbols-outlined">${place.icon}</span>
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });

        const marker = L.marker(place.coords, { icon: customIcon });
        
        const popupContent = `
            <div class="p-2 min-w-[180px]">
                <div class="flex items-center gap-2 mb-1">
                    <span class="material-symbols-outlined text-primary text-[18px]">${place.icon}</span>
                    <h4 class="font-bold text-sm text-gray-900 dark:text-white">${place.name}</h4>
                </div>
                <p class="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mb-2">${place.desc}</p>
                <button onclick="window.zoomToPlace(${place.id})" class="w-full py-1.5 rounded-lg bg-gray-50 dark:bg-white/5 text-[10px] font-bold text-primary hover:bg-primary hover:text-white transition-all border border-primary/20">Navigate Here</button>
            </div>
        `;

        marker.bindPopup(popupContent);
        markerInstances[place.id] = marker;
        markersLayer.addLayer(marker);
        
        return marker;
    }

    function getCategoryColor(cat) {
        switch(cat) {
            case 'academic': return '#0ea5e9'; // Blue
            case 'admin': return '#6366f1';    // Indigo
            case 'hostel': return '#f59e0b';   // Amber
            case 'food': return '#ec4899';     // Pink
            default: return '#64748b';        // Slate
        }
    }

    // 6. UI Logic (Search, Filter, List)
    const searchInput = document.getElementById('place-search');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const placesList = document.getElementById('places-list');

    let currentFilter = 'all';
    let currentSearch = '';

    function renderPlacesList() {
        const filtered = campusPlaces.filter(p => {
            const matchesCategory = currentFilter === 'all' || p.category === currentFilter;
            const matchesSearch = p.name.toLowerCase().includes(currentSearch.toLowerCase());
            return matchesCategory && matchesSearch;
        });

        placesList.innerHTML = filtered.map(p => `
            <button onclick="window.zoomToPlace(${p.id})" class="w-full group flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-slate-900 border border-transparent hover:border-primary/30 hover:bg-white dark:hover:bg-slate-800 transition-all text-left">
                <div class="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors shadow-sm">
                    <span class="material-symbols-outlined text-[20px]">${p.icon}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-bold text-gray-900 dark:text-white truncate">${p.name}</div>
                    <div class="text-[10px] text-gray-400 uppercase tracking-wider font-bold opacity-60">${p.category}</div>
                </div>
                <span class="material-symbols-outlined text-gray-300 group-hover:text-primary transition-all text-[18px] group-hover:translate-x-1">chevron_right</span>
            </button>
        `).join('');

        if (filtered.length === 0) {
            placesList.innerHTML = `
                <div class="py-10 text-center">
                    <span class="material-symbols-outlined text-gray-300 dark:text-gray-600 text-4xl mb-2">location_off</span>
                    <p class="text-xs text-gray-400 font-medium">No places found matching your criteria.</p>
                </div>
            `;
        }

        // Update markers visibility
        markersLayer.clearLayers();
        filtered.forEach(p => markersLayer.addLayer(markerInstances[p.id]));
    }

    // 7. Global Actions
    window.zoomToPlace = (id) => {
        const place = campusPlaces.find(p => p.id === id);
        if (!place) return;

        map.flyTo(place.coords, 18, {
            duration: 1.5,
            easeLinearity: 0.25
        });

        // Small delay to let zoom finish before opening popup
        setTimeout(() => {
            markerInstances[id].openPopup();
        }, 1500);

        // Mobile UX: Scroll to map if needed
        if (window.innerWidth < 1024) {
            document.getElementById('map').scrollIntoView({ behavior: 'smooth' });
        }
    };

    // 8. Event Listeners
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        renderPlacesList();
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active', 'bg-primary', 'text-white'));
            btn.classList.add('active', 'bg-primary', 'text-white');
            currentFilter = btn.dataset.category;
            renderPlacesList();
        });
    });

    document.getElementById('reset-map').addEventListener('click', () => {
        map.flyTo(mapCenter, mapZoom, { duration: 1.5 });
    });

    // 9. Coordinate Capture
    const coordDisplay = document.getElementById('coord-display');
    const copyBtn = document.getElementById('copy-coords');

    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        const coordStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        coordDisplay.textContent = coordStr;
        coordDisplay.classList.add('text-primary');
        
        // Visual feedback
        coordDisplay.animate([
            { opacity: 0.5, transform: 'scale(0.95)' },
            { opacity: 1, transform: 'scale(1)' }
        ], { duration: 300 });
    });

    copyBtn.addEventListener('click', () => {
        const text = coordDisplay.textContent;
        if (text === 'Click map to capture') return;

        navigator.clipboard.writeText(text).then(() => {
            const originalIcon = copyBtn.innerHTML;
            copyBtn.innerHTML = '<span class="material-symbols-outlined text-emerald-500 text-[18px]">check</span>';
            setTimeout(() => {
                copyBtn.innerHTML = originalIcon;
            }, 2000);
            
            if (window.updateGlobalFeedback) {
                window.updateGlobalFeedback({
                    type: 'success',
                    message: 'Coordinates copied to clipboard!',
                    duration: 2000
                });
            }
        });
    });

    // Initialize markers and list
    campusPlaces.forEach(p => createMarker(p));
    renderPlacesList();
});
