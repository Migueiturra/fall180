import { createClient } from "@supabase/supabase-js";

type CourseSummary = {
  id: string;
  title: string;
  description: string;
  lessons: number;
};

type Course = {
  id: string;
  title: string;
  description: string;
  lessons?: Array<unknown>;
  [key: string]: unknown;
};

type CourseRow = {
  id: string;
  title: string;
  description: string | null;
  lesson_count: number | null;
  payload: Course;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

function rowToSummary(row: CourseRow): CourseSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    lessons: row.lesson_count || row.payload?.lessons?.length || 0
  };
}

function coursePayload(course: Course) {
  return {
    id: course.id,
    title: course.title,
    description: course.description || "",
    lesson_count: course.lessons?.length || 0,
    payload: course,
    updated_at: new Date().toISOString()
  };
}

export async function loadSupabaseCourseList(): Promise<CourseSummary[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("courses")
    .select("id,title,description,lesson_count,payload")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => rowToSummary(row as CourseRow));
}

export async function loadSupabaseCourse(id: string): Promise<Course | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("courses")
    .select("payload")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data?.payload as Course | undefined) || null;
}

export async function createSupabaseCourse(course: Course): Promise<CourseSummary> {
  if (!supabase) throw new Error("Supabase no esta configurado.");

  const { data, error } = await supabase
    .from("courses")
    .insert(coursePayload(course))
    .select("id,title,description,lesson_count,payload")
    .single();

  if (error) throw error;
  return rowToSummary(data as CourseRow);
}

export async function saveSupabaseCourse(course: Course): Promise<void> {
  if (!supabase) throw new Error("Supabase no esta configurado.");

  const { error } = await supabase
    .from("courses")
    .upsert(coursePayload(course), { onConflict: "id" });

  if (error) throw error;
}

export async function deleteSupabaseCourse(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase no esta configurado.");

  const { error } = await supabase
    .from("courses")
    .delete()
    .eq("id", id);

  if (error) throw error;
}
