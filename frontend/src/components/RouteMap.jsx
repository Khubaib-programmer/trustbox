import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

const ROUTE_COORDINATES = [
  [28.5562, 77.1000], // Airport Cargo Gateway
  [28.5615, 77.1145],
  [28.5682, 77.1320],
  [28.5750, 77.1550],
  [28.5650, 77.1780],
  [28.5520, 77.2050],
  [28.5410, 77.2280],
  [28.5385, 77.2510],
  [28.5398, 77.2750], // Hospital Regional Center
];

export default function RouteMap({ currentSeq = 0 }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [28.555, 77.185],
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      });

      // Position minimal zoom control at bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Free, open standard tiles — 100% no API key required
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(map);

      const isDark = document.documentElement.classList.contains('dark');
      const lineColor = isDark ? '#FAFAFA' : '#0A0A0A';

      // Thin 2px route line
      L.polyline(ROUTE_COORDINATES, {
        color: lineColor,
        weight: 2,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // Origin point marker (Airport)
      L.circleMarker(ROUTE_COORDINATES[0], {
        radius: 4,
        fillColor: lineColor,
        color: '#FFFFFF',
        weight: 1.5,
        fillOpacity: 1,
      }).addTo(map);

      // Destination point marker (Hospital)
      L.circleMarker(ROUTE_COORDINATES[ROUTE_COORDINATES.length - 1], {
        radius: 4,
        fillColor: '#9CA3AF',
        color: '#FFFFFF',
        weight: 1.5,
        fillOpacity: 1,
      }).addTo(map);

      // Moving Box Marker: small circle marker with white ring
      const boxMarker = L.circleMarker(ROUTE_COORDINATES[0], {
        radius: 6,
        fillColor: lineColor,
        color: '#FFFFFF',
        weight: 2,
        fillOpacity: 1,
      }).addTo(map);

      markerRef.current = boxMarker;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update marker position on sequence advance
  useEffect(() => {
    if (!markerRef.current) return;
    const pointIndex = currentSeq % ROUTE_COORDINATES.length;
    const coord = ROUTE_COORDINATES[pointIndex];
    markerRef.current.setLatLng(coord);
  }, [currentSeq]);

  return (
    <div className="relative w-full h-[320px] rounded-20 overflow-hidden bg-surface border border-hairline">
      <div className="absolute top-4 left-4 z-[400] flex items-center gap-2 pointer-events-none">
        <span className="text-[12px] font-medium tracking-tight bg-surface/90 backdrop-blur-sm px-2.5 py-1 rounded-md border border-hairline text-muted">
          Airport Hub → Regional Center
        </span>
      </div>

      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
