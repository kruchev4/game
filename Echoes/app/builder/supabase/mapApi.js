import { supabase } from "./client";

export async function fetchMap(id) {
  const { data, error } = await supabase
    .from("maps")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function saveMap(id, json) {
  const payload = {
    id,
    json,
    width: json.width,
    height: json.height,
    name: json.name,
    type: json.type,
  };

  const { error } = await supabase.from("maps").upsert(payload);
  if (error) throw error;
}