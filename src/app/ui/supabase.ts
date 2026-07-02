import { createClient } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

export type AuthProfile = {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  role: "user" | "super_admin";
  created_at?: string;
};

type CourseSummary = {
  id: string;
  title: string;
  description: string;
  lessons: number;
  durationMinutes?: number;
  coverImageUrl?: string;
  updatedAt?: string;
};

type Course = {
  id: string;
  title: string;
  description: string;
  lessons?: Array<unknown>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

type CourseRow = {
  id: string;
  owner_id?: string | null;
  title: string;
  description: string | null;
  lesson_count: number | null;
  payload: Course;
  updated_at?: string | null;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

function supabaseErrorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === "string") return error || fallback;
  if (typeof error === "object") {
    const item = error as { message?: string; details?: string; hint?: string; code?: string; status?: number };
    return [
      item.message,
      item.details ? `Detalle: ${item.details}` : "",
      item.hint ? `Sugerencia: ${item.hint}` : "",
      item.code ? `Codigo: ${item.code}` : "",
      item.status ? `Estado: ${item.status}` : ""
    ].filter(Boolean).join(" ");
  }
  return fallback;
}

function throwSupabaseError(error: unknown, fallback: string): never {
  throw new Error(supabaseErrorMessage(error, fallback));
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  let { data, error } = await supabase.auth.getSession();
  if (error) throwSupabaseError(error, "No se pudo leer la sesion de Supabase.");
  if (!data.session && window.location.hash.includes("access_token")) {
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    const retry = await supabase.auth.getSession();
    data = retry.data;
    error = retry.error;
    if (error) throwSupabaseError(error, "No se pudo completar la sesion de Supabase.");
  }
  return data.session;
}

export function onAuthSessionChange(callback: (session: Session | null) => void) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function loadCurrentProfile(): Promise<AuthProfile | null> {
  try {
    return await ensureCurrentProfile();
  } catch (error) {
    console.warn("No se pudo sincronizar el perfil de Supabase.", error);
    return authFallbackProfile();
  }
}

async function authFallbackProfile(): Promise<AuthProfile | null> {
  if (!supabase) return null;
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throwSupabaseError(userError, "No se pudo leer el usuario de Supabase.");
  const user = userData.user;
  if (!user) return null;

  const metadata = user.user_metadata || {};
  return {
    id: user.id,
    email: user.email || "",
    full_name: String(metadata.full_name || metadata.name || ""),
    avatar_url: String(metadata.avatar_url || metadata.picture || ""),
    role: "user" as const
  };
}

async function ensureCurrentProfile(): Promise<AuthProfile | null> {
  if (!supabase) return null;
  const fallbackProfile = await authFallbackProfile();
  if (!fallbackProfile) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,avatar_url,role,created_at")
    .eq("id", fallbackProfile.id)
    .maybeSingle();

  if (error) throwSupabaseError(error, "No se pudo leer el perfil en Supabase.");
  if (data) return data as AuthProfile;

  const { data: inserted, error: insertError } = await supabase
    .from("profiles")
    .insert(fallbackProfile)
    .select("id,email,full_name,avatar_url,role,created_at")
    .single();

  if (insertError) throwSupabaseError(insertError, "No se pudo crear el perfil en Supabase.");
  return inserted as AuthProfile;
}

function cleanRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error("Supabase no esta configurado.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: cleanRedirectUrl()
    }
  });
  if (error) throwSupabaseError(error, "No se pudo iniciar sesion con Google.");
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) throw new Error("Supabase no esta configurado.");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throwSupabaseError(error, "No se pudo iniciar sesion.");
}

export async function signUpWithEmail(email: string, password: string, fullName: string) {
  if (!supabase) throw new Error("Supabase no esta configurado.");
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }
    }
  });
  if (error) throwSupabaseError(error, "No se pudo crear la cuenta.");
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throwSupabaseError(error, "No se pudo cerrar sesion.");
}

async function currentUserId() {
  if (!supabase) return "";
  const { data, error } = await supabase.auth.getUser();
  if (error) throwSupabaseError(error, "No se pudo leer el usuario de Supabase.");
  return data.user?.id || "";
}

function rowToSummary(row: CourseRow): CourseSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    lessons: row.lesson_count || row.payload?.lessons?.length || 0,
    durationMinutes: Number(row.payload?.metadata?.durationMinutes) || estimateDuration(row.payload),
    coverImageUrl: typeof row.payload?.metadata?.coverImageUrl === "string" ? row.payload.metadata.coverImageUrl : undefined,
    updatedAt: row.updated_at || undefined
  };
}

function estimateDuration(course: Course) {
  const lessons = Array.isArray(course.lessons) ? course.lessons : [];
  const blockCount = lessons.reduce((sum, lesson: any) => sum + (Array.isArray(lesson?.blocks) ? lesson.blocks.length : 0), 0);
  return Math.max(3, Math.round(blockCount * 1.5));
}

function coursePayload(course: Course, ownerId?: string) {
  return {
    id: course.id,
    ...(ownerId ? { owner_id: ownerId } : {}),
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
    .select("id,owner_id,title,description,lesson_count,payload,updated_at")
    .order("updated_at", { ascending: false });

  if (error) throwSupabaseError(error, "No se pudo cargar la lista de cursos desde Supabase.");
  return (data || []).map((row) => rowToSummary(row as CourseRow));
}

export async function loadSupabaseCourse(id: string): Promise<Course | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("courses")
    .select("payload,owner_id")
    .eq("id", id)
    .maybeSingle();

  if (error) throwSupabaseError(error, "No se pudo cargar el curso desde Supabase.");
  if (!data?.payload) return null;
  const course = data.payload as Course;
  return {
    ...course,
    metadata: {
      ...(course.metadata || {}),
      ...(data.owner_id ? { ownerId: data.owner_id } : {})
    }
  };
}

export async function createSupabaseCourse(course: Course): Promise<CourseSummary> {
  if (!supabase) throw new Error("Supabase no esta configurado.");
  await ensureCurrentProfile();
  const ownerId = await currentUserId();
  if (!ownerId) throw new Error("Debes iniciar sesion para crear cursos.");

  const { data, error } = await supabase
    .from("courses")
    .insert(coursePayload(course, ownerId))
    .select("id,owner_id,title,description,lesson_count,payload,updated_at")
    .single();

  if (error) throwSupabaseError(error, "No se pudo crear el curso en Supabase.");
  return rowToSummary(data as CourseRow);
}

export async function saveSupabaseCourse(course: Course): Promise<void> {
  if (!supabase) throw new Error("Supabase no esta configurado.");
  await ensureCurrentProfile();
  const userId = await currentUserId();
  const ownerId = typeof course.metadata?.ownerId === "string" ? course.metadata.ownerId : userId;
  if (!userId || !ownerId) throw new Error("Debes iniciar sesion para guardar cursos.");

  const { data: existing, error: findError } = await supabase
    .from("courses")
    .select("id,owner_id")
    .eq("id", course.id)
    .maybeSingle();

  if (findError) throwSupabaseError(findError, "No se pudo verificar el curso en Supabase.");

  if (existing) {
    const currentOwnerId = existing.owner_id || ownerId;
    const { data, error } = await supabase
      .from("courses")
      .update(coursePayload(course, currentOwnerId))
      .eq("id", course.id)
      .select("id")
      .single();

    if (error) throwSupabaseError(error, "No se pudo guardar el curso en Supabase.");
    if (!data) throw new Error("No se pudo guardar el curso. Revisa los permisos del propietario.");
    return;
  }

  const { error } = await supabase
    .from("courses")
    .insert(coursePayload(course, ownerId));

  if (error) throwSupabaseError(error, "No se pudo crear el curso en Supabase.");
}

export async function deleteSupabaseCourse(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase no esta configurado.");

  const { data, error } = await supabase
    .from("courses")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) throwSupabaseError(error, "No se pudo eliminar el curso en Supabase.");
  if (!data?.length) throw new Error("No se pudo eliminar el curso. Puede que no tengas permisos sobre este curso.");
}

export async function uploadSupabaseAsset(file: File): Promise<string> {
  if (!supabase) throw new Error("Supabase no esta configurado.");
  const ownerId = await currentUserId();
  if (!ownerId) throw new Error("Debes iniciar sesion para subir archivos.");

  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${ownerId}/uploads/${Date.now()}-${Math.floor(Math.random() * 100000)}-${safeName || `asset.${extension}`}`;
  const { error } = await supabase.storage.from("course-assets").upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });

  if (error) throwSupabaseError(error, "No se pudo subir el archivo a Supabase Storage.");
  const { data } = supabase.storage.from("course-assets").getPublicUrl(path);
  return data.publicUrl;
}
