"use client";
import { useEffect, useState } from "react";
import { fetchMap, saveMap } from "../../supabase/mapApi";
import { GameMap } from "../../../../game/engine/world/GameMap";
import { renderMap } from "../../../../game/engine/render/renderer";

export default function MapEditor({ params }) {
  const [map, setMap] = useState(null);

  useEffect(() => {
    fetchMap(params.id).then((data) => {
      setMap(new GameMap(data.json));
    });
  }, [params.id]);

  useEffect(() => {
    if (!map) return;
    const canvas = document.getElementById("map-editor-canvas");
    const ctx = canvas.getContext("2d");
    renderMap(ctx, map, { x: 0, y: 0, w: canvas.width, h: canvas.height });
  }, [map]);

  const handleSave = async () => {
    await saveMap(params.id, map);
    alert("Saved!");
  };

  return (
    <div className="flex">
      <canvas id="map-editor-canvas" width={960} height={720} />
      <div className="p-4">
        <button onClick={handleSave}>Save Map</button>
      </div>
    </div>
  );
}
