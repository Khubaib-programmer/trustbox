import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

// Sample realistic medical cold-chain corridor route (Delhi International Airport Cargo Hub -> Apollo Hospital)
const ROUTE_COORDINATES = [
  [28.5562, 77.1000], // Airport Cargo Gateway
  [28.5615, 77.1145],
  [28.5682, 77.1320],
  [28.5750, 77.1550],
  [28.5650, 77.1780],
  [28.5520, 77.2050],
  [28.5410, 77.2280],
  [28.5385, 77.2510],
  [28.5398, 77.2750], // Apollo Regional Medical Center Hub
];

export default function RouteMap({ currentSeq = 0 }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Initialize Leaflet map
      const map = L.map(mapContainerRef.current, {
        center: [28.555, 77.18],
        zoom: 12,
        zoomControl: false,
        attributionControl: false
      });

      // OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      // Draw route polyline
      const polyline = L.polyline(ROUTE_COORDINATES, {
        color: '#10b981',
        weight: 4,
        opacity: 0.8,
        dashArray: '8, 8'
      }).addTo(map);

      // Start Marker
      L.circleMarker(ROUTE_COORDINATES[0], {
        radius: 7,
        fillColor: '#3b82f6',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1
      }).bindTooltip('Origin: Airport Pharma Cargo', { permanent: false }).addTo(map);

      // Destination Marker
      L.circleMarker(ROUTE_COORDINATES[ROUTE_COORDINATES.length - 1], {
        radius: 7,
        fillColor: '#ec4899',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1
      }).bindTooltip('Destination: Regional Hospital', { permanent: false }).addTo(map);

      // Moving Box Marker
      const boxIcon = L.divIcon({
        className: 'custom-box-pin',
        html: `<div style="background-color: #10b981; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 12px #10b981;"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const currentMarker = L.marker(ROUTE_COORDINATES[0], { icon: boxIcon }).addTo(map);
      markerRef.current = currentMarker;
      mapInstanceRef.current = map;
    }

    return () => {
      // Map cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update marker position as seq advances
  useEffect(() => {
    if (!markerRef.current) return;
    const pointIndex = currentSeq % ROUTE_COORDINATES.length;
    const coord = ROUTE_COORDINATES[pointIndex];
    markerRef.current.setLatLng(coord);
  }, [currentSeq]);

  return (
    <div className="relative w-full h-full min-h-[260px] rounded-xl overflow-hidden border border-slate-800 shadow-inner">
      {/* Required Simulated Route Banner */}
      <div className="absolute top-3 left-3 z-[1000] bg-slate-900/90 backdrop-blur-md border border-amber-500/50 text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block"></span>
        <span>SIMULATED ROUTE</span>
        <span className="text-slate-400 font-normal">| Device has no onboard GPS</span>
      </div>

      <div className="absolute bottom-3 right-3 z-[1000] bg-slate-900/90 backdrop-blur-md border border-slate-700 text-slate-300 text-[11px] px-2.5 py-1 rounded shadow">
        Waypoint #{currentSeq % ROUTE_COORDINATES.length + 1} of {ROUTE_COORDINATES.length}
      </div>

      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}

