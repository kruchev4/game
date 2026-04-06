"use client";
import { useEffect, useState } from "react";
import { fetchMap, saveMap } from "../../supabase/mapApi";
import { dungeonToTilemap } from "../../../../game/engine/dungeon/dungeonToTilemap";
import { GameMap } from "../../../../game/engine/world/GameMap";
import { renderMap } from "../../../../game/engine/render/renderer";

export default function DungeonEditor({ params }) {
  const [dungeonJson, setDungeonJson] = useState(null);
  const [tilemap, setTilemap] = useState(null);

  useEffect(() => {
    fetchMap(params.id).then((data) => {
      setDungeonJson(data.json);
      setTilemap(new GameMap(dungeonToTilemap(data.json)));
    });
  }, [params.id]);

  const handleSave = async () => {
    const finalJson = dungeonToTilemap(dungeonJson);
    await saveMap(params.id, finalJson);
    alert("Dungeon Saved!");
  };

  useEffect(() => {
    if (!tilemap) return;
    const canvas = document.getElementById("dungeon-editor-canvas");
    const ctx = canvas.getContext("2d");

    renderMap(ctx, tilemap, { x: 0, y: 0, w: canvas.width, h: canvas.height });
  }, [tilemap]);

  return (
    <div className="flex">
      <canvas id="dungeon-editor-canvas" width={960} height={720} />
      <div className="p-4">
        <button onClick={handleSave}>Save Dungeon</button>
      </div>
    </div>
  );
}