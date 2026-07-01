import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  ArrowDown,
  ArrowUp,
  AlignCenter,
  AlignLeft,
  AlignRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Eye,
  FileQuestion,
  Image,
  LayoutDashboard,
  ListChecks,
  List,
  ListOrdered,
  GalleryHorizontalEnd,
  MousePointerClick,
  Minus,
  PanelLeft,
  Pencil,
  Plus,
  Save,
  Search,
  Settings,
  Trash2,
  Upload,
  Video
} from "lucide-react";
import demoCourseData from "../../../course/courses/curso-demo-scorm.json";
import {
  createSupabaseCourse,
  deleteSupabaseCourse,
  isSupabaseConfigured,
  loadSupabaseCourse,
  loadSupabaseCourseList,
  saveSupabaseCourse
} from "./supabase";
import "./styles.css";

type BlockType =
  | "heading"
  | "paragraph"
  | "image_text"
  | "image_gallery"
  | "statement"
  | "flip_cards"
  | "accordion"
  | "list"
  | "embed"
  | "custom_html"
  | "quiz_single_choice"
  | "quiz_multiple_response"
  | "quiz_fill_blank"
  | "quiz_matching"
  | "continue_button"
  | "divider";

type CourseSummary = {
  id: string;
  title: string;
  description: string;
  lessons: number;
  durationMinutes?: number;
  updatedAt?: string;
};

type Lesson = {
  id: string;
  title: string;
  blocks: CourseBlock[];
};

type Course = {
  id: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  theme?: Record<string, unknown>;
  scorm?: { passingScore?: number; [key: string]: unknown };
  lessons: Lesson[];
};

type CourseBlock = {
  id: string;
  type: BlockType;
  content: Record<string, any>;
};

const colors = ["#181833", "#3C3C59", "#7A7A8C", "#8C8CBF", "#8182F2", "#2F6FED", "#119C8D", "#D14D3F", "#F2A93B"];
const demoCourse = demoCourseData as Course;
const staticCoursesKey = "fall180-static-courses";

const blockTools: Array<{ type: BlockType; label: string; icon: React.ReactNode }> = [
  { type: "heading", label: "Titulo", icon: <BookOpen size={15} /> },
  { type: "paragraph", label: "Parrafo", icon: <PanelLeft size={15} /> },
  { type: "image_text", label: "Imagen + texto", icon: <Image size={15} /> },
  { type: "image_gallery", label: "Solo imagen", icon: <GalleryHorizontalEnd size={15} /> },
  { type: "statement", label: "Statement", icon: <Copy size={15} /> },
  { type: "flip_cards", label: "Tarjetas", icon: <MousePointerClick size={15} /> },
  { type: "accordion", label: "Acordeon", icon: <RowsIcon /> },
  { type: "list", label: "Lista", icon: <List size={15} /> },
  { type: "embed", label: "Embed", icon: <Video size={15} /> },
  { type: "custom_html", label: "HTML", icon: <Code2 size={15} /> },
  { type: "quiz_single_choice", label: "Opcion unica", icon: <FileQuestion size={15} /> },
  { type: "quiz_multiple_response", label: "Multiple", icon: <ListChecks size={15} /> },
  { type: "quiz_fill_blank", label: "Completar", icon: <Pencil size={15} /> },
  { type: "quiz_matching", label: "Coincidencia", icon: <ShuffleIcon /> },
  { type: "continue_button", label: "Continuar", icon: <ChevronRight size={15} /> },
  { type: "divider", label: "Separador", icon: <Minus size={15} /> }
];

const blockToolGroups: Array<{ title: string; tools: BlockType[]; defaultOpen?: boolean }> = [
  { title: "Texto", tools: ["heading", "paragraph", "statement", "list", "divider"], defaultOpen: true },
  { title: "Media", tools: ["image_text", "image_gallery", "embed", "custom_html"], defaultOpen: true },
  { title: "Interaccion", tools: ["flip_cards", "accordion", "continue_button"] },
  { title: "Evaluacion", tools: ["quiz_single_choice", "quiz_multiple_response", "quiz_fill_blank", "quiz_matching"] }
];

function blockToolByType(type: BlockType) {
  return blockTools.find((tool) => tool.type === type)!;
}

function RowsIcon() {
  return <span className="grid gap-[2px]"><i className="block h-[2px] w-[14px] rounded bg-current" /><i className="block h-[2px] w-[14px] rounded bg-current" /><i className="block h-[2px] w-[14px] rounded bg-current" /></span>;
}

function ShuffleIcon() {
  return <span className="text-[13px] font-black leading-none">↔</span>;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function getCourseId() {
  return new URLSearchParams(window.location.search).get("course") || "curso-demo-scorm";
}

function appRoute(path: string) {
  if (path === "/") return "./";
  return path.replace(/^\//, "");
}

function isStaticDeploy() {
  return window.location.hostname.endsWith("github.io");
}

function courseSummary(course: Course): CourseSummary {
  return {
    id: course.id || "curso-demo-scorm",
    title: course.title,
    description: course.description,
    lessons: course.lessons?.length || 0,
    durationMinutes: Number(course.metadata?.durationMinutes) || estimateDuration(course),
    updatedAt: String(course.metadata?.updatedAt || "Actualizado hoy")
  };
}

function estimateDuration(course: Course) {
  const blockCount = course.lessons?.reduce((sum, lesson) => sum + (lesson.blocks?.length || 0), 0) || 0;
  return Math.max(3, Math.round(blockCount * 1.5));
}

function duplicateBlock(block: CourseBlock): CourseBlock {
  return { ...structuredClone(block), id: uid("b") };
}

function readStaticCourses(): Course[] {
  try {
    const saved = window.localStorage.getItem(staticCoursesKey);
    if (saved) return JSON.parse(saved);
  } catch {
    // Local storage can be unavailable in strict browser modes.
  }
  return [structuredClone(demoCourse)];
}

function writeStaticCourses(courses: Course[]) {
  try {
    window.localStorage.setItem(staticCoursesKey, JSON.stringify(courses));
  } catch {
    // Demo mode remains read-only if localStorage is blocked.
  }
}

async function loadCourseList(): Promise<CourseSummary[]> {
  if (isSupabaseConfigured) {
    try {
      return await loadSupabaseCourseList();
    } catch {
      // Supabase can be configured but unavailable during local prototyping.
    }
  }

  if (!isStaticDeploy()) {
    try {
      const response = await fetch("/api/courses");
      if (response.ok) {
        const result = await response.json();
        return result.courses || [];
      }
    } catch {
      // Fall back to static demo data.
    }
  }
  return readStaticCourses().map(courseSummary);
}

async function loadCourseById(id: string): Promise<Course> {
  if (isSupabaseConfigured) {
    try {
      const course = await loadSupabaseCourse(id);
      if (course) return course as Course;
    } catch {
      // Keep the editor usable if Supabase is temporarily unavailable.
    }
  }

  if (!isStaticDeploy()) {
    try {
      const response = await fetch(`/api/course?id=${encodeURIComponent(id)}`);
      if (response.ok) return response.json();
    } catch {
      // Fall back to static demo data.
    }
  }
  return structuredClone(readStaticCourses().find((course) => course.id === id) || demoCourse);
}

async function createCourseRecord(): Promise<CourseSummary> {
  const course = structuredClone(demoCourse);
  course.id = `nuevo-curso-${Date.now()}`;
  course.title = "Nuevo curso";
  course.description = "Describe el objetivo de este curso.";
  course.lessons = [{
    id: uid("lesson"),
    title: "Bienvenida",
    blocks: [defaultBlock("heading"), defaultBlock("paragraph")]
  }];

  if (isSupabaseConfigured) {
    try {
      return await createSupabaseCourse(course);
    } catch {
      // Fall through to the current persistence layer.
    }
  }

  if (!isStaticDeploy()) {
    const response = await fetch("/api/courses", { method: "POST" });
    if (response.ok) {
      const result = await response.json();
      if (result.ok) return result.course;
    }
  }

  const courses = readStaticCourses();
  courses.push(course);
  writeStaticCourses(courses);
  return courseSummary(course);
}

async function saveCourseRecord(course: Course): Promise<{ ok: boolean; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      await saveSupabaseCourse(course);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "No se pudo guardar en Supabase." };
    }
  }

  if (!isStaticDeploy()) {
    try {
      const response = await fetch(`/api/course?id=${encodeURIComponent(course.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(course)
      });
      if (response.ok) return response.json();
    } catch {
      // Fall back to local demo persistence.
    }
  }

  const courses = readStaticCourses();
  const index = courses.findIndex((item) => item.id === course.id);
  if (index >= 0) courses[index] = course;
  else courses.push(course);
  writeStaticCourses(courses);
  return { ok: true };
}

function htmlToText(value = "") {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = value;
  return wrapper.textContent || "";
}

function rich(content: Record<string, any>, field: string) {
  return content[`${field}Html`] || content[field] || "";
}

function blockPaddingClass(content: Record<string, any>) {
  const value = content.blockPadding || "medium";
  if (value === "none") return "px-0 py-0";
  if (value === "small") return "px-3 py-3 md:px-4 md:py-4";
  if (value === "large") return "px-4 py-8 md:px-14 md:py-12";
  return "px-4 py-5 md:px-8 md:py-7";
}

function blockWidthClass(content: Record<string, any>) {
  const value = content.contentWidth || "m";
  if (value === "s") return "md:max-w-2xl";
  if (value === "l") return "md:max-w-none";
  return "md:max-w-4xl";
}

function blockScreenMap(lesson: Lesson) {
  let screen = 0;
  return lesson.blocks.map((block) => {
    const current = screen;
    if (block.type === "continue_button") screen += 1;
    return current;
  });
}

function screenCount(lesson: Lesson) {
  return lesson.blocks.filter((block) => block.type === "continue_button").length + 1;
}

function isQuestionType(type: BlockType) {
  return ["quiz_single_choice", "quiz_multiple_response", "quiz_fill_blank", "quiz_matching"].includes(type);
}

function progressForLesson(lesson: Lesson, revealedScreen: number, correctQuestions: Record<string, boolean>) {
  const map = blockScreenMap(lesson);
  const scored = lesson.blocks.filter((block) => block.type !== "continue_button");
  if (!scored.length) return 100;
  const done = scored.filter((block) => {
    const index = lesson.blocks.findIndex((item) => item.id === block.id);
    if (map[index] > revealedScreen) return false;
    return isQuestionType(block.type) ? correctQuestions[block.id] === true : true;
  }).length;
  return Math.round((done / scored.length) * 100);
}

function defaultBlock(type: BlockType): CourseBlock {
  if (type === "heading") return { id: uid("b"), type, content: { text: "Nuevo titulo", textHtml: "Nuevo titulo" } };
  if (type === "paragraph") return { id: uid("b"), type, content: { text: "Escribe aqui el contenido.", textHtml: "Escribe aqui el contenido." } };
  if (type === "image_text") {
    return { id: uid("b"), type, content: { imageUrl: "assets/demo-learning.svg", imageAlt: "Imagen", imageSize: 180, title: "Titulo del bloque", text: "Descripcion asociada.", textHtml: "Descripcion asociada." } };
  }
  if (type === "image_gallery") return { id: uid("b"), type, content: { title: "Imagen", images: [{ url: "assets/demo-learning.svg", alt: "Imagen" }], imageHeight: 360, hasFrame: true } };
  if (type === "statement") return { id: uid("b"), type, content: { text: "You're the master of your life. Steer it with intention.", textHtml: "You're the master of your life. Steer it with intention.", showDivider: true, width: "normal" } };
  if (type === "flip_cards") return { id: uid("b"), type, content: { title: "Tarjetas interactivas", cards: [{ front: "Concepto", back: "Texto que aparece al hacer clic." }, { front: "Idea clave", back: "Otra explicacion breve." }] } };
  if (type === "accordion") return { id: uid("b"), type, content: { title: "Acordeon", items: [{ title: "Pregunta o tema", text: "Contenido desplegable." }, { title: "Otro tema", text: "Mas informacion." }] } };
  if (type === "list") return { id: uid("b"), type, content: { title: "Lista", listStyle: "bullet", items: ["Primer punto", "Segundo punto", "Tercer punto"] } };
  if (type === "embed") return { id: uid("b"), type, content: { title: "Video o recurso embebido", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", caption: "", size: "wide", aspectRatio: "16 / 9", hasFrame: true } };
  if (type === "custom_html") return { id: uid("b"), type, content: { title: "Contenido HTML custom", html: "<div class='p-6 text-center'><h2 class='text-2xl font-bold'>Bloque HTML</h2><p class='mt-2'>Escribe tu codigo.</p></div>", size: "wide", aspectRatio: "16 / 9", hasFrame: true, htmlSizing: "auto", htmlHeight: 420, htmlWidthMode: "fixed", htmlWidth: 400, htmlAlign: "center", htmlVerticalAlign: "center", enableTailwind: true } };
  if (type === "quiz_single_choice") return { id: uid("b"), type, content: { question: "Escribe la pregunta", options: ["Alternativa correcta", "Alternativa incorrecta"], correctAnswer: 0, required: true, feedbackCorrect: "Correcto.", feedbackIncorrect: "Revisa la respuesta." } };
  if (type === "quiz_multiple_response") return { id: uid("b"), type, content: { question: "Selecciona todas las alternativas correctas", options: ["Respuesta correcta", "Otra respuesta correcta", "Distractor"], correctAnswers: [0, 1], required: true, feedbackCorrect: "Correcto.", feedbackIncorrect: "Revisa las alternativas." } };
  if (type === "quiz_fill_blank") return { id: uid("b"), type, content: { question: "Completa la frase", prompt: "La pieza que reconoce el LMS es el archivo ____.", answers: ["imsmanifest.xml"], caseSensitive: false, required: true, feedbackCorrect: "Correcto.", feedbackIncorrect: "Revisa la respuesta." } };
  if (type === "quiz_matching") return { id: uid("b"), type, content: { question: "Relaciona cada concepto con su descripcion", pairs: [{ prompt: "SCORM", match: "Paquete que conversa con el LMS" }, { prompt: "Manifest", match: "Archivo que describe el contenido" }], required: true, feedbackCorrect: "Correcto.", feedbackIncorrect: "Revisa las coincidencias." } };
  if (type === "continue_button") return { id: uid("b"), type, content: { label: "Continuar", buttonSize: "medium", buttonColor: "#181833" } };
  return { id: uid("b"), type: "divider", content: {} };
}

function App() {
  const path = window.location.pathname;
  if (path.includes("preview")) return <PreviewApp />;
  if (path.includes("courses")) return <DashboardApp />;
  return <EditorApp />;
}

function AppHeader({ section }: { section: "dashboard" | "editor" | "preview" }) {
  return (
    <header className="sticky top-0 z-30 flex h-[56px] items-center border-b border-line bg-white/90 px-4 backdrop-blur-xl">
      <a className="flex w-[220px] items-center gap-2 no-underline" href={appRoute("/courses.html")}>
        <span className="grid size-4 place-items-center rounded-full bg-violet/20">
          <span className="size-1.5 rounded-full bg-violet" />
        </span>
        <strong className="text-base text-ink">PulseStudio</strong>
      </a>
      <nav className="hidden items-center gap-1 text-xs font-extrabold text-ink md:flex">
        <a className={section === "dashboard" ? "rounded-md bg-mist px-2.5 py-2 text-violet" : "rounded-md px-2.5 py-2 hover:bg-mist"} href={appRoute("/courses.html")}>Dashboard</a>
        <a className={section === "editor" ? "rounded-md bg-mist px-2.5 py-2 text-violet" : "rounded-md px-2.5 py-2 hover:bg-mist"} href={appRoute("/")}>Editor</a>
        <a className={section === "preview" ? "rounded-md bg-mist px-2.5 py-2 text-violet" : "rounded-md px-2.5 py-2 hover:bg-mist"} href={`${appRoute("/preview.html")}?course=${getCourseId()}`}>Preview</a>
      </nav>
      <div className="flex items-center gap-2" id="header-actions" />
    </header>
  );
}

function DashboardApp() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CourseSummary | null>(null);

  async function load() {
    setCourses(await loadCourseList());
  }

  async function createCourse() {
    const course = await createCourseRecord();
    window.location.href = `${appRoute("/")}?course=${encodeURIComponent(course.id)}`;
  }

  async function deleteCourse() {
    if (!deleteTarget) return;
    if (isSupabaseConfigured) {
      try {
        await deleteSupabaseCourse(deleteTarget.id);
        setDeleteTarget(null);
        load();
        return;
      } catch {
        // Use the previous delete path when Supabase is not reachable.
      }
    }

    if (isStaticDeploy()) {
      writeStaticCourses(readStaticCourses().filter((course) => course.id !== deleteTarget.id));
      setDeleteTarget(null);
      load();
      return;
    }
    const response = await fetch(`/api/courses/${encodeURIComponent(deleteTarget.id)}`, { method: "DELETE" });
    const result = await response.json();
    if (result.ok) {
      setDeleteTarget(null);
      load();
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = courses.filter((course) => `${course.title} ${course.description}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <Tooltip.Provider>
      <AppHeader section="dashboard" />
      <button onClick={createCourse} className="fixed right-6 top-5 z-40 inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-sm font-extrabold text-white shadow-soft"><Plus size={16} /> Crear nuevo</button>
      <main className="grid min-h-[calc(100vh-76px)] grid-cols-[260px_minmax(0,1fr)] bg-white">
        <aside className="border-r border-line p-4">
          <button onClick={createCourse} className="mb-5 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-violet text-sm font-extrabold text-white"><Plus size={16} /> Create New</button>
          {["All Content", "Shared With Me", "My Shortcuts", "Private", "Team"].map((item, index) => (
            <a key={item} className={`block rounded-md px-3 py-3 text-sm font-bold ${index === 0 ? "bg-mist text-ink" : "text-steel"}`} href="#">{item}</a>
          ))}
          <p className="mt-8 text-xs font-black uppercase tracking-[0.12em] text-violet">External connections</p>
          <a className="mt-3 block px-3 py-2 text-sm font-bold text-steel" href="#">Moodle Sandbox</a>
          <a className="block px-3 py-2 text-sm font-bold text-steel" href="#">SCORM exports</a>
        </aside>
        <section className="p-9">
          <div className="mb-7 grid grid-cols-[1fr_minmax(280px,480px)_150px_170px] items-center gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-violet">Contenido</p>
              <h1 className="m-0 text-3xl font-black tracking-[-0.03em] text-ink">All Content</h1>
            </div>
            <label className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-steel" size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-md border border-line pl-11 pr-4 text-sm font-semibold outline-none focus:border-violet" placeholder="Search all content" />
            </label>
            <select className="h-11 rounded-md border border-line px-3 text-sm font-semibold"><option>Recent</option><option>Title</option></select>
            <select className="h-11 rounded-md border border-line px-3 text-sm font-semibold"><option>All Content</option><option>Courses</option></select>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,220px))] gap-4">
            {filtered.map((course, index) => (
              <CourseCard key={course.id} course={course} index={index} onDelete={() => setDeleteTarget(course)} />
            ))}
          </div>
        </section>
      </main>
      <ConfirmDelete course={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={deleteCourse} />
    </Tooltip.Provider>
  );
}

function CourseCard({ course, index, onDelete }: { course: CourseSummary; index: number; onDelete: () => void }) {
  const covers = ["bg-violet", "bg-lavender", "bg-steel", "bg-plum", "bg-ink"];
  const updated = course.updatedAt?.startsWith("20") ? new Date(course.updatedAt).toLocaleDateString("es-CL") : course.updatedAt || "Actualizado hoy";
  return (
    <article className="overflow-hidden rounded-md border border-line bg-white shadow-soft transition hover:-translate-y-0.5 hover:border-violet/50">
      <div className={`flex h-20 items-end p-3 ${covers[index % covers.length]}`}>
        <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-white">Course</span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 text-xs font-bold text-steel"><span className="grid size-5 place-items-center rounded-full bg-violet/15 text-violet">P</span> PulseStudio</div>
        <h2 className="mt-2 line-clamp-2 text-base font-black leading-tight tracking-[-0.02em] text-ink">{course.title}</h2>
        <p className="mt-1.5 line-clamp-2 min-h-9 text-xs leading-relaxed text-steel">{course.description}</p>
        <div className="my-3 grid grid-cols-2 gap-1 text-[11px] font-bold text-steel">
          <span>{course.durationMinutes || 3} min</span>
          <span>{course.lessons} unidades</span>
          <span className="col-span-2">{updated}</span>
        </div>
        <div className="my-4 grid gap-1 text-xs font-bold text-steel"><span>Course · {course.lessons} Lessons</span><span>Updated today</span></div>
        <div className="flex flex-wrap gap-2">
          <a className="rounded-md border border-line px-2.5 py-1.5 text-xs font-extrabold" href={`${appRoute("/")}?course=${course.id}`}>Editar</a>
          <a className="rounded-md border border-line px-2.5 py-1.5 text-xs font-extrabold" href={`${appRoute("/preview.html")}?course=${course.id}`}>Preview</a>
          <button className="rounded-md border border-red-100 px-2.5 py-1.5 text-xs font-extrabold text-red-600" onClick={onDelete}><Trash2 size={13} /></button>
        </div>
      </div>
    </article>
  );
}

function ConfirmDelete({ course, onCancel, onConfirm }: { course: CourseSummary | null; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Dialog.Root open={Boolean(course)} onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/35" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-soft">
          <Dialog.Title className="text-xl font-black text-ink">Eliminar curso</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-steel">Vas a eliminar "{course?.title}". Esta accion no se puede deshacer.</Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={onCancel} className="rounded-md border border-line px-4 py-2 text-sm font-extrabold">Cancelar</button>
            <button onClick={onConfirm} className="rounded-md bg-red-600 px-4 py-2 text-sm font-extrabold text-white">Eliminar</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EditorApp() {
  const [course, setCourse] = useState<Course | null>(null);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState("");
  const courseId = getCourseId();

  async function load() {
    setCourse(await loadCourseById(courseId));
  }

  useEffect(() => {
    load();
  }, []);

  function updateCourse(mutator: (draft: Course) => void) {
    setCourse((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      mutator(next);
      return next;
    });
    setDirty(true);
  }

  async function save() {
    if (!course) return false;
    const courseToSave = structuredClone(course);
    courseToSave.metadata = courseToSave.metadata || {};
    courseToSave.metadata.updatedAt = new Date().toISOString();
    const result = await saveCourseRecord(courseToSave);
    if (!result.ok) {
      setToast(result.error || "No se pudo guardar.");
      return false;
    }
    setCourse(courseToSave);
    setDirty(false);
    setToast("Curso guardado.");
    window.setTimeout(() => setToast(""), 2200);
    return true;
  }

  async function exportScorm() {
    if (isStaticDeploy()) {
      setToast("La exportacion SCORM requiere ejecutar el proyecto localmente con npm start.");
      window.setTimeout(() => setToast(""), 3600);
      return;
    }
    if (dirty) {
      const saved = await save();
      if (!saved) return;
    }
    const response = await fetch(`/api/export?id=${encodeURIComponent(course?.id || courseId)}`, { method: "POST" });
    const result = await response.json();
    if (result.ok) window.location.href = result.zipUrl;
  }

  function addBlock(type: BlockType, insertIndex?: number) {
    updateCourse((draft) => {
      const block = defaultBlock(type);
      const blocks = draft.lessons[lessonIndex].blocks;
      if (typeof insertIndex === "number") blocks.splice(insertIndex, 0, block);
      else blocks.push(block);
      setEditingBlockId(block.id);
    });
  }

  function addLesson() {
    updateCourse((draft) => {
      draft.lessons.push({ id: uid("lesson"), title: `Nueva leccion ${draft.lessons.length + 1}`, blocks: [defaultBlock("heading"), defaultBlock("paragraph")] });
      setLessonIndex(draft.lessons.length - 1);
    });
  }

  if (!course) return <div className="grid min-h-screen place-items-center text-sm font-bold text-steel">Cargando editor...</div>;

  const lesson = course.lessons[lessonIndex] || course.lessons[0];
  const editingBlock = lesson?.blocks.find((block) => block.id === editingBlockId) || null;

  return (
    <Tooltip.Provider>
      <AppHeader section="editor" />
      <div className="fixed right-4 top-2.5 z-40 flex gap-1.5">
        <span className="grid h-9 place-items-center rounded-full border border-line bg-white px-3 text-[11px] font-extrabold text-ink">{dirty ? "Sin guardar" : "Guardado"}</span>
        <CourseSettingsDialog course={course} onChange={updateCourse} />
        <a className="grid h-9 place-items-center rounded-md border border-line bg-white px-3 text-xs font-extrabold" href={appRoute("/courses.html")}>Cursos</a>
        <a className="grid h-9 place-items-center rounded-md border border-line bg-white px-3 text-xs font-extrabold" href={`${appRoute("/preview.html")}?course=${course.id}`}>Vista previa</a>
        <button onClick={save} className="inline-flex h-9 items-center gap-2 rounded-md bg-mist px-3 text-xs font-extrabold"><Save size={14} /> Guardar</button>
        <button onClick={exportScorm} className="inline-flex h-9 items-center gap-2 rounded-md bg-ink px-3 text-xs font-extrabold text-white"><Upload size={14} /> Exportar SCORM</button>
      </div>
      <main className="grid min-h-[calc(100vh-56px)] grid-cols-[220px_minmax(0,1fr)] gap-3 bg-[#f0f0f8] p-3">
        <aside className="sticky top-[68px] flex h-[calc(100vh-80px)] flex-col overflow-hidden rounded-lg bg-white shadow-soft">
          <section className="border-b border-line p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-violet">Bloques</p>
            <h2 className="mt-0.5 text-sm font-black tracking-[-0.02em] text-ink">Herramientas</h2>
            <div className="mt-2 grid gap-1">
              {blockToolGroups.map((group) => <SidebarToolGroup key={group.title} group={group} onAdd={addBlock} />)}
            </div>
          </section>
          <section className="flex min-h-0 flex-1 flex-col p-3">
            <div className="mb-2.5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-violet">Curso</p>
                <h2 className="text-base font-black tracking-[-0.02em] text-ink">Unidades</h2>
              </div>
              <button className="rounded-md bg-mist px-2.5 py-1.5 text-xs font-extrabold" onClick={addLesson}>Agregar</button>
            </div>
            <div className="grid min-h-0 flex-1 auto-rows-min gap-1.5 overflow-y-auto pr-1">
              {course.lessons.map((item, index) => (
                <LessonRow key={item.id} lesson={item} active={index === lessonIndex} onSelect={() => { setLessonIndex(index); setEditingBlockId(null); }} onMove={(direction) => updateCourse((draft) => moveLesson(draft.lessons, index, direction, setLessonIndex))} onDelete={() => updateCourse((draft) => {
                  if (draft.lessons.length <= 1) return;
                  draft.lessons.splice(index, 1);
                  setLessonIndex(Math.max(0, index - 1));
                })} />
              ))}
            </div>
          </section>
        </aside>
        <section className="relative rounded-lg bg-white p-4 shadow-soft">
          <div className="mb-4 border-b border-line pb-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-violet">Editor</p>
              <input value={lesson.title} onChange={(event) => updateCourse((draft) => { draft.lessons[lessonIndex].title = event.target.value; })} className="mt-0.5 w-full border-0 bg-transparent text-lg font-black tracking-[-0.02em] text-ink outline-none" />
            </div>
          </div>
          <div className="grid gap-2.5 pb-20">
            {lesson.blocks.map((block, index) => (
              <React.Fragment key={block.id}>
                {index > 0 ? <InlineInsertBlockBar onAdd={(type) => addBlock(type, index)} /> : null}
                <BlockShell block={block} editing={block.id === editingBlockId} onEdit={() => setEditingBlockId(block.id)} onSave={async () => { await save(); setEditingBlockId(null); }} onDuplicate={() => updateCourse((draft) => {
                  const copy = duplicateBlock(block);
                  draft.lessons[lessonIndex].blocks.splice(index + 1, 0, copy);
                  setEditingBlockId(copy.id);
                })} onMove={(direction) => updateCourse((draft) => moveItem(draft.lessons[lessonIndex].blocks, index, direction))} onDelete={() => updateCourse((draft) => {
                  draft.lessons[lessonIndex].blocks.splice(index, 1);
                  setEditingBlockId(null);
                })} onChange={(content) => updateCourse((draft) => { draft.lessons[lessonIndex].blocks[index].content = content; })} />
              </React.Fragment>
            ))}
          </div>
          <BottomBlockBar onAdd={addBlock} />
        </section>
      </main>
      {toast ? <div className="fixed bottom-5 right-5 rounded-lg bg-ink px-5 py-3 text-sm font-bold text-white shadow-soft">{toast}</div> : null}
    </Tooltip.Provider>
  );
}

function CourseSettingsDialog({ course, onChange }: { course: Course; onChange: (mutator: (draft: Course) => void) => void }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-xs font-extrabold">
          <Settings size={14} /> Datos del curso
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/35" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(520px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-soft">
          <Dialog.Title className="text-2xl font-black tracking-[-0.03em] text-ink">Datos del curso</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-steel">
            Configura la informacion general. Despues puedes seguir editandola desde este panel.
          </Dialog.Description>
          <div className="mt-5 rounded-lg border border-line bg-white p-4">
            <Field label="Titulo" value={course.title} onChange={(value) => onChange((draft) => { draft.title = value; })} />
            <TextField label="Descripcion" value={course.description} onChange={(value) => onChange((draft) => { draft.description = value; })} rows={4} />
            <Field label="Duracion estimada en minutos" type="number" value={String(Number(course.metadata?.durationMinutes) || estimateDuration(course))} onChange={(value) => onChange((draft) => { draft.metadata = draft.metadata || {}; draft.metadata.durationMinutes = Number(value) || estimateDuration(draft); })} />
            <Field label="Puntaje minimo" type="number" value={String(course.scorm?.passingScore || 70)} onChange={(value) => onChange((draft) => { draft.scorm = draft.scorm || {}; draft.scorm.passingScore = Number(value); })} />
          </div>
          <div className="mt-6 flex justify-end">
            <Dialog.Close asChild>
              <button className="rounded-md bg-ink px-4 py-2 text-sm font-extrabold text-white">Listo</button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SidebarToolButton({ tool, onAdd }: { tool: { type: BlockType; label: string; icon: React.ReactNode }; onAdd: (type: BlockType) => void }) {
  return (
    <button onClick={() => onAdd(tool.type)} className="group flex h-7 min-w-0 items-center gap-2 rounded-md px-1.5 text-left text-[11px] font-bold text-ink transition hover:bg-mist">
      <span className="grid size-5 shrink-0 place-items-center rounded bg-mist text-plum transition group-hover:bg-white group-hover:text-violet">{tool.icon}</span>
      <span className="truncate">{tool.label}</span>
    </button>
  );
}

function SidebarToolGroup({ group, onAdd }: { group: { title: string; tools: BlockType[]; defaultOpen?: boolean }; onAdd: (type: BlockType) => void }) {
  return (
    <details className="rounded-md border border-line/80 bg-white" open={group.defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-steel hover:bg-mist">
        <span>{group.title}</span>
        <ChevronRight className="transition details-chevron" size={13} />
      </summary>
      <div className="grid gap-0.5 border-t border-line/70 p-1.5">
        {group.tools.map((type) => <SidebarToolButton key={type} tool={blockToolByType(type)} onAdd={onAdd} />)}
      </div>
    </details>
  );
}

function InlineInsertBlockBar({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false);

  function add(type: BlockType) {
    onAdd(type);
    setOpen(false);
  }

  return (
    <div className="group relative -my-1 grid min-h-7 place-items-center">
      <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-line opacity-0 transition group-hover:opacity-100" />
      <button
        type="button"
        aria-label="Agregar bloque aqui"
        onClick={() => setOpen((current) => !current)}
        className={`relative z-10 grid size-6 place-items-center rounded-full border border-line bg-white text-violet shadow-sm transition hover:border-violet hover:bg-mist ${open ? "scale-100 opacity-100" : "scale-95 opacity-0 group-hover:scale-100 group-hover:opacity-100"}`}
      >
        <Plus size={14} />
      </button>
      {open ? (
        <div className="relative z-20 mt-1 flex max-w-[min(760px,calc(100vw-320px))] flex-wrap items-center justify-center gap-1 rounded-xl border border-violet/20 bg-white/95 px-2 py-1.5 shadow-soft backdrop-blur-xl">
          {blockTools.map((tool) => (
            <Tooltip.Root key={tool.type}>
              <Tooltip.Trigger asChild>
                <button type="button" aria-label={tool.label} onClick={() => add(tool.type)} className="grid size-8 place-items-center rounded-md text-ink transition hover:bg-mist hover:text-violet">
                  {tool.icon}
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="rounded bg-ink px-2 py-1 text-xs font-bold text-white" sideOffset={8}>{tool.label}</Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BottomBlockBar({ onAdd }: { onAdd: (type: BlockType) => void }) {
  return (
    <div className="sticky bottom-3 z-20 mx-auto mt-5 max-w-4xl rounded-xl border border-violet/20 bg-white/95 p-2 shadow-soft backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <span className="hidden shrink-0 pl-2 text-[10px] font-black uppercase tracking-[0.12em] text-violet md:block">Agregar</span>
        <div className="flex flex-1 flex-wrap justify-center gap-0.5 md:justify-end">
          {blockTools.map((tool) => (
            <Tooltip.Root key={tool.type}>
              <Tooltip.Trigger asChild>
                <button aria-label={tool.label} onClick={() => onAdd(tool.type)} className="grid size-8 place-items-center rounded-md text-ink transition hover:bg-mist hover:text-violet">
                  {tool.icon}
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content className="rounded bg-ink px-2 py-1 text-xs font-bold text-white" sideOffset={8}>{tool.label}</Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ))}
        </div>
      </div>
    </div>
  );
}

function LessonRow({ lesson, active, onSelect, onMove, onDelete }: { lesson: Lesson; active: boolean; onSelect: () => void; onMove: (direction: number) => void; onDelete: () => void }) {
  return (
    <article className={`grid grid-cols-[1fr_auto] items-center gap-1.5 rounded-md border px-2.5 py-1.5 ${active ? "border-violet bg-mist" : "border-line bg-white"}`}>
      <button onClick={onSelect} className="truncate text-left text-[13px] font-medium text-ink">{lesson.title}</button>
      <div className="flex gap-0.5">
        <IconButton label="Subir" onClick={() => onMove(-1)}><ArrowUp size={12} /></IconButton>
        <IconButton label="Bajar" onClick={() => onMove(1)}><ArrowDown size={12} /></IconButton>
        <IconButton label="Borrar" danger onClick={onDelete}><Trash2 size={12} /></IconButton>
      </div>
    </article>
  );
}

function IconButton({ label, onClick, children, danger = false }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button aria-label={label} onClick={onClick} className={`grid size-6 place-items-center rounded-md border border-transparent ${danger ? "text-red-600 hover:bg-red-50" : "text-steel hover:bg-white hover:text-ink"}`}>{children}</button>
      </Tooltip.Trigger>
      <Tooltip.Portal><Tooltip.Content className="rounded bg-ink px-2 py-1 text-xs font-bold text-white">{label}</Tooltip.Content></Tooltip.Portal>
    </Tooltip.Root>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="mt-4 grid gap-2 text-xs font-extrabold text-steel">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border border-line px-3 text-sm font-semibold text-ink outline-none focus:border-violet" /></label>;
}

function TextField({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return <label className="mt-4 grid gap-2 text-xs font-extrabold text-steel">{label}<textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-line p-3 text-sm font-semibold text-ink outline-none focus:border-violet" /></label>;
}

function linesToImages(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((url) => ({ url, alt: "Imagen" }));
}

function imagesToLines(images: Array<{ url: string }>) {
  return (images || []).map((image) => image.url).join("\n");
}

function linesToItems(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function BlockShell({ block, editing, onEdit, onSave, onDuplicate, onMove, onDelete, onChange }: { block: CourseBlock; editing: boolean; onEdit: () => void; onSave: () => void; onDuplicate: () => void; onMove: (direction: number) => void; onDelete: () => void; onChange: (content: Record<string, any>) => void }) {
  const patch = (next: Record<string, any>) => onChange({ ...block.content, ...next });
  return (
    <article className={`grid grid-cols-[64px_minmax(0,1fr)_auto] overflow-hidden rounded-md border ${editing ? "border-violet bg-white shadow-soft" : "border-line bg-white"}`}>
      <button onClick={onEdit} className={`border-r border-line text-[11px] font-black ${editing ? "bg-mist text-ink" : "text-violet hover:bg-mist"}`}>Editar</button>
      <div className="p-0">
        {editing ? (
          <>
            <BlockLayoutControls content={block.content} onChange={patch} />
            <BlockContentFrame block={block}>
              <BlockForm block={block} onChange={onChange} />
            </BlockContentFrame>
          </>
        ) : (
          <BlockContentFrame block={block}>
            <BlockPreview block={block} />
          </BlockContentFrame>
        )}
      </div>
      <div className="flex items-center gap-0.5 p-3">
        <IconButton label="Duplicar" onClick={onDuplicate}><Copy size={12} /></IconButton>
        <IconButton label="Subir" onClick={() => onMove(-1)}><ArrowUp size={12} /></IconButton>
        <IconButton label="Bajar" onClick={() => onMove(1)}><ArrowDown size={12} /></IconButton>
        <IconButton label="Borrar" danger onClick={onDelete}><Trash2 size={12} /></IconButton>
      </div>
      {editing ? <div className="col-span-3 flex justify-end border-t border-line p-3"><button onClick={onSave} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-xs font-extrabold text-white"><Save size={13} /> Guardar bloque</button></div> : null}
    </article>
  );
}

function BlockLayoutControls({ content, onChange }: { content: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line bg-[#fbfbff] px-3 py-2">
      <SegmentedControl label="Padding" value={content.blockPadding || "medium"} options={[["none", "Ninguno"], ["small", "Peq."], ["medium", "Med."], ["large", "Grande"]]} onChange={(value) => onChange({ blockPadding: value })} />
      <SegmentedControl label="Ancho" value={content.contentWidth || "m"} options={[["s", "S"], ["m", "M"], ["l", "L"]]} onChange={(value) => onChange({ contentWidth: value })} />
      <HexColorField label="Fondo" value={content.blockBackground || ""} onChange={(value) => onChange({ blockBackground: value })} allowEmpty />
    </div>
  );
}

function HexColorField({ label, value, onChange, allowEmpty = false }: { label: string; value: string; onChange: (value: string) => void; allowEmpty?: boolean }) {
  const safeValue = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff";
  return (
    <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-steel">
      {label}
      <input type="color" value={safeValue} onChange={(event) => onChange(event.target.value)} className="size-7 rounded-md border border-line bg-white p-0" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={allowEmpty ? "auto" : "#181833"} className="h-7 w-24 rounded-md border border-line px-2 text-[11px] font-bold normal-case tracking-normal text-ink outline-none focus:border-violet" />
    </label>
  );
}

function SegmentedControl({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.1em] text-steel">{label}</span>
      <div className="flex overflow-hidden rounded-md border border-line bg-white">
        {options.map(([id, name]) => <button key={id} onClick={() => onChange(id)} className={`h-7 px-2.5 text-[11px] font-extrabold ${value === id ? "bg-ink text-white" : "text-steel hover:bg-mist"}`}>{name}</button>)}
      </div>
    </div>
  );
}

function BlockContentFrame({ block, children }: { block: CourseBlock; children: React.ReactNode }) {
  const background = /^#[0-9a-fA-F]{6}$/.test(block.content.blockBackground || "") ? block.content.blockBackground : undefined;
  return (
    <div className={`${blockPaddingClass(block.content)} ${background ? "rounded-md" : ""}`} style={background ? { background } : undefined}>
      <div className={`w-full ${blockWidthClass(block.content)} mx-auto`}>
        {children}
      </div>
    </div>
  );
}

function RichTextarea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (html: string) => void; rows?: number }) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [size, setSize] = useState("16");
  const [hex, setHex] = useState("#181833");

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value || "";
  }, [value]);

  function saveSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) savedRangeRef.current = range.cloneRange();
  }

  function restoreSelection() {
    const range = savedRangeRef.current;
    if (!range) return;
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function sync() {
    saveSelection();
    onChange(editorRef.current?.innerHTML || "");
  }

  function command(name: string, commandValue?: string) {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(name, false, commandValue);
    sync();
  }

  function applyInlineStyle(style: Partial<CSSStyleDeclaration>) {
    const editor = editorRef.current;
    const range = savedRangeRef.current;
    if (!editor || !range || range.collapsed) return;
    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    const span = document.createElement("span");
    Object.assign(span.style, style);
    span.appendChild(range.extractContents());
    range.insertNode(span);
    const nextRange = document.createRange();
    nextRange.selectNodeContents(span);
    selection?.removeAllRanges();
    selection?.addRange(nextRange);
    savedRangeRef.current = nextRange.cloneRange();
    sync();
  }

  function applySize(nextSize: string) {
    setSize(nextSize);
    applyInlineStyle({ fontSize: `${Number(nextSize) || 16}px` });
  }

  function applyColor(nextColor: string) {
    setHex(nextColor);
    if (/^#[0-9a-fA-F]{6}$/.test(nextColor)) applyInlineStyle({ color: nextColor });
  }

  return (
    <div className="grid gap-2">
      <span className="text-xs font-extrabold text-steel">{label}</span>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("bold")} className="grid size-7 place-items-center rounded-md bg-mist text-sm font-black">B</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("italic")} className="grid size-7 place-items-center rounded-md bg-mist text-sm font-black italic">I</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("underline")} className="grid size-7 place-items-center rounded-md bg-mist text-sm font-black underline">U</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("justifyLeft")} className="grid size-7 place-items-center rounded-md bg-mist text-sm font-black"><AlignLeft size={14} /></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("justifyCenter")} className="grid size-7 place-items-center rounded-md bg-mist text-sm font-black"><AlignCenter size={14} /></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command("justifyRight")} className="grid size-7 place-items-center rounded-md bg-mist text-sm font-black"><AlignRight size={14} /></button>
        <input type="number" min="8" max="72" value={size} onMouseDown={saveSelection} onFocus={saveSelection} onChange={(event) => applySize(event.target.value)} className="h-7 w-14 rounded-md border border-line px-2 text-xs font-extrabold" title="Tamano de letra" />
        {colors.map((color) => <button key={color} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyColor(color)} className="size-7 rounded-full border border-line" style={{ background: color }} />)}
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#181833"} onChange={(event) => applyColor(event.target.value)} className="size-7 rounded-full border border-line bg-white p-0" />
        <input value={hex} onChange={(event) => applyColor(event.target.value)} className="h-7 w-24 rounded-md border border-line px-2 text-xs font-bold outline-none focus:border-violet" placeholder="#181833" />
      </div>
      <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={sync} onMouseUp={saveSelection} onKeyUp={saveSelection} onBlur={saveSelection} className="min-h-28 rounded-md border border-line bg-white p-3 text-sm font-semibold leading-7 text-ink outline-none focus:border-violet" style={{ minHeight: `${Math.max(rows, 3) * 34}px` }} />
    </div>
  );
}

function BlockForm({ block, onChange }: { block: CourseBlock; onChange: (content: Record<string, any>) => void }) {
  const c = block.content;
  const patch = (next: Record<string, any>) => onChange({ ...c, ...next });

  if (block.type === "heading" || block.type === "paragraph") return <RichTextarea label="Texto" value={rich(c, "text")} onChange={(html) => patch({ textHtml: html, text: htmlToText(html) })} rows={block.type === "heading" ? 2 : 7} />;
  if (block.type === "statement") return <RichTextarea label="Statement" value={rich(c, "text")} onChange={(html) => patch({ textHtml: html, text: htmlToText(html) })} rows={5} />;
  if (block.type === "image_text") return <div className="grid gap-4"><Field label="URL imagen" value={c.imageUrl || ""} onChange={(value) => patch({ imageUrl: value })} /><Field label="Tamano imagen px" type="number" value={String(c.imageSize || 180)} onChange={(value) => patch({ imageSize: Number(value) || 180 })} /><Field label="Titulo" value={c.title || ""} onChange={(value) => patch({ title: value })} /><RichTextarea label="Texto" value={rich(c, "text")} onChange={(html) => patch({ textHtml: html, text: htmlToText(html) })} /></div>;
  if (block.type === "image_gallery") return <ImageGalleryForm content={c} onChange={patch} />;
  if (block.type === "flip_cards") return <div className="grid gap-4"><Field label="Titulo" value={c.title || ""} onChange={(value) => patch({ title: value })} />{(c.cards || []).map((card: any, index: number) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2"><Field label={`Frente ${index + 1}`} value={card.front || ""} onChange={(value) => { const cards = [...(c.cards || [])]; cards[index] = { ...card, front: value }; patch({ cards }); }} /><Field label="Reverso" value={card.back || ""} onChange={(value) => { const cards = [...(c.cards || [])]; cards[index] = { ...card, back: value }; patch({ cards }); }} /><button className="mt-6 grid size-10 place-items-center rounded-md text-red-600 hover:bg-red-50" onClick={() => patch({ cards: (c.cards || []).filter((_: any, i: number) => i !== index) })}><Trash2 size={15} /></button></div>)}<button className="w-fit rounded-md bg-mist px-3 py-2 text-sm font-extrabold" onClick={() => patch({ cards: [...(c.cards || []), { front: "Nueva tarjeta", back: "Texto oculto" }] })}>Agregar tarjeta</button></div>;
  if (block.type === "accordion") return <div className="grid gap-4"><Field label="Titulo" value={c.title || ""} onChange={(value) => patch({ title: value })} />{(c.items || []).map((item: any, index: number) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2"><Field label={`Item ${index + 1}`} value={item.title || ""} onChange={(value) => { const items = [...(c.items || [])]; items[index] = { ...item, title: value }; patch({ items }); }} /><Field label="Texto" value={item.text || ""} onChange={(value) => { const items = [...(c.items || [])]; items[index] = { ...item, text: value }; patch({ items }); }} /><button className="mt-6 grid size-10 place-items-center rounded-md text-red-600 hover:bg-red-50" onClick={() => patch({ items: (c.items || []).filter((_: any, i: number) => i !== index) })}><Trash2 size={15} /></button></div>)}<button className="w-fit rounded-md bg-mist px-3 py-2 text-sm font-extrabold" onClick={() => patch({ items: [...(c.items || []), { title: "Nuevo item", text: "Contenido" }] })}>Agregar item</button></div>;
  if (block.type === "list") return <div className="grid gap-4"><Field label="Titulo" value={c.title || ""} onChange={(value) => patch({ title: value })} /><SelectField label="Tipo" value={c.listStyle || "bullet"} onChange={(value) => patch({ listStyle: value })} options={[["bullet", "Puntos"], ["number", "1, 2, 3"]]} /><TextField label="Items, uno por linea" value={(c.items || []).join("\n")} onChange={(value) => patch({ items: linesToItems(value) })} rows={6} /></div>;
  if (block.type === "embed") return <div className="grid gap-4"><Field label="Titulo" value={c.title || ""} onChange={(value) => patch({ title: value })} /><Field label="URL" value={c.url || ""} onChange={(value) => patch({ url: value })} /><Field label="Bajada" value={c.caption || ""} onChange={(value) => patch({ caption: value })} /></div>;
  if (block.type === "custom_html") return <div className="grid gap-4"><Field label="Titulo" value={c.title || ""} onChange={(value) => patch({ title: value })} /><TextField label="Codigo HTML" value={c.html || ""} onChange={(value) => patch({ html: value })} rows={9} /><SelectField label="Alineacion horizontal" value={c.htmlAlign || "center"} onChange={(value) => patch({ htmlAlign: value })} options={[["left", "Izquierda"], ["center", "Centro"], ["right", "Derecha"]]} /><SelectField label="Alineacion vertical" value={c.htmlVerticalAlign || "center"} onChange={(value) => patch({ htmlVerticalAlign: value })} options={[["top", "Arriba"], ["center", "Centro"], ["bottom", "Abajo"]]} /><SelectField label="Ancho" value={c.htmlWidthMode || "fixed"} onChange={(value) => patch({ htmlWidthMode: value })} options={[["fixed", "Fijo en px"], ["full", "Todo el bloque"]]} /><Field label="Ancho iframe px" type="number" value={String(customHtmlWidth(c))} onChange={(value) => patch({ htmlWidth: Number(value) || 400 })} /><SelectField label="Alto" value={c.htmlSizing || "auto"} onChange={(value) => patch({ htmlSizing: value })} options={[["auto", "Segun contenido"], ["fixed", "Fijo en px"]]} /><Field label="Alto/minimo px" type="number" value={String(Number(c.htmlHeight) || 420)} onChange={(value) => patch({ htmlHeight: Number(value) || 420 })} /><SelectField label="Marco" value={c.hasFrame === false ? "no" : "yes"} onChange={(value) => patch({ hasFrame: value === "yes" })} options={[["yes", "Con marco"], ["no", "Sin marco"]]} /><SelectField label="Tailwind / HyperUI" value={c.enableTailwind === false ? "no" : "yes"} onChange={(value) => patch({ enableTailwind: value === "yes" })} options={[["yes", "Activado"], ["no", "Desactivado"]]} /></div>;
  if (block.type === "continue_button") return <div className="grid gap-4"><Field label="Texto del boton" value={c.label || "Continuar"} onChange={(value) => patch({ label: value })} /><SelectField label="Tamano boton" value={c.buttonSize || "medium"} onChange={(value) => patch({ buttonSize: value })} options={[["small", "Pequeno"], ["medium", "Mediano"], ["full", "Grande / ancho completo"]]} /><HexColorField label="Color" value={c.buttonColor || "#181833"} onChange={(value) => patch({ buttonColor: value })} /></div>;
  if (block.type === "divider") return <p className="text-sm font-bold text-steel">Este bloque no necesita configuracion.</p>;
  return <QuizForm block={block} onChange={onChange} />;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="grid gap-2 text-xs font-extrabold text-steel">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border border-line px-3 text-sm font-semibold text-ink">{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
}

function ImageGalleryForm({ content, onChange }: { content: Record<string, any>; onChange: (patch: Record<string, any>) => void }) {
  const images = content.images?.length ? content.images : [{ url: "", alt: "Imagen" }];

  function updateImage(index: number, patch: Record<string, string>) {
    const next = images.map((image: any, itemIndex: number) => itemIndex === index ? { ...image, ...patch } : image);
    onChange({ images: next });
  }

  return (
    <div className="grid gap-4">
      <Field label="Titulo opcional" value={content.title || ""} onChange={(value) => onChange({ title: value })} />
      <div className="grid gap-2">
        <span className="text-xs font-extrabold text-steel">Imagenes</span>
        {images.map((image: any, index: number) => (
          <div key={index} className="grid grid-cols-[1fr_auto] gap-2">
            <input value={image.url || ""} onChange={(event) => updateImage(index, { url: event.target.value })} placeholder="https://..." className="h-10 rounded-md border border-line px-3 text-sm font-semibold text-ink outline-none focus:border-violet" />
            <button type="button" className="grid size-10 place-items-center rounded-md text-red-600 hover:bg-red-50" onClick={() => onChange({ images: images.filter((_: any, itemIndex: number) => itemIndex !== index) })}><Trash2 size={15} /></button>
          </div>
        ))}
        <button type="button" className="w-fit rounded-md bg-mist px-3 py-2 text-sm font-extrabold" onClick={() => onChange({ images: [...images, { url: "", alt: "Imagen" }] })}>Agregar imagen</button>
      </div>
      <Field label="Alto maximo en px" type="number" value={String(Number(content.imageHeight) || imageHeightPx(content))} onChange={(value) => onChange({ imageHeight: Number(value) || 360 })} />
      <SelectField label="Marco" value={content.hasFrame === false ? "no" : "yes"} onChange={(value) => onChange({ hasFrame: value === "yes" })} options={[["yes", "Con marco"], ["no", "Sin marco"]]} />
    </div>
  );
}

function QuizForm({ block, onChange }: { block: CourseBlock; onChange: (content: Record<string, any>) => void }) {
  const c = block.content;
  const patch = (next: Record<string, any>) => onChange({ ...c, ...next });
  const options = c.options || [];

  if (block.type === "quiz_fill_blank") {
    return <div className="grid gap-4"><Field label="Pregunta" value={c.question || ""} onChange={(value) => patch({ question: value })} /><Field label="Frase" value={c.prompt || ""} onChange={(value) => patch({ prompt: value })} /><TextField label="Respuestas correctas, una por linea" value={(c.answers || []).join("\n")} onChange={(value) => patch({ answers: value.split("\n").map((item) => item.trim()).filter(Boolean) })} rows={4} /></div>;
  }
  if (block.type === "quiz_matching") {
    return <div className="grid gap-4"><Field label="Pregunta" value={c.question || ""} onChange={(value) => patch({ question: value })} />{(c.pairs || []).map((pair: any, index: number) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2"><Field label={`Concepto ${index + 1}`} value={pair.prompt} onChange={(value) => { const pairs = [...c.pairs]; pairs[index] = { ...pair, prompt: value }; patch({ pairs }); }} /><Field label="Coincidencia" value={pair.match} onChange={(value) => { const pairs = [...c.pairs]; pairs[index] = { ...pair, match: value }; patch({ pairs }); }} /><button className="mt-6 grid size-10 place-items-center rounded-md text-red-600 hover:bg-red-50" onClick={() => patch({ pairs: c.pairs.filter((_: any, i: number) => i !== index) })}><Trash2 size={15} /></button></div>)}<button className="w-fit rounded-md bg-mist px-3 py-2 text-sm font-extrabold" onClick={() => patch({ pairs: [...(c.pairs || []), { prompt: "Concepto", match: "Coincidencia" }] })}>Agregar par</button></div>;
  }
  return <div className="grid gap-4"><Field label="Pregunta" value={c.question || ""} onChange={(value) => patch({ question: value })} />{options.map((option: string, index: number) => <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-2"><Field label={`Alternativa ${index + 1}`} value={option} onChange={(value) => { const next = [...options]; next[index] = value; patch({ options: next }); }} /><SelectField label="Correcta" value={block.type === "quiz_multiple_response" ? (c.correctAnswers || []).includes(index) ? "yes" : "no" : c.correctAnswer === index ? "yes" : "no"} onChange={(value) => {
    if (block.type === "quiz_multiple_response") {
      const set = new Set(c.correctAnswers || []);
      value === "yes" ? set.add(index) : set.delete(index);
      patch({ correctAnswers: [...set].sort() });
    } else if (value === "yes") patch({ correctAnswer: index });
  }} options={[["no", "No"], ["yes", "Si"]]} /><button className="mt-6 grid size-10 place-items-center rounded-md text-red-600 hover:bg-red-50" onClick={() => patch({ options: options.filter((_: string, i: number) => i !== index) })}><Trash2 size={15} /></button></div>)}<button className="w-fit rounded-md bg-mist px-3 py-2 text-sm font-extrabold" onClick={() => patch({ options: [...options, "Nueva alternativa"] })}>Agregar alternativa</button></div>;
}

function BlockPreview({ block, onQuizStatusChange }: { block: CourseBlock; onQuizStatusChange?: (blockId: string, correct: boolean) => void }) {
  const c = block.content;
  if (block.type === "heading") return <h3 className="text-2xl font-black tracking-[-0.03em]" dangerouslySetInnerHTML={{ __html: rich(c, "text") }} />;
  if (block.type === "paragraph") return <div className="rich-output text-sm leading-7 text-plum" dangerouslySetInnerHTML={{ __html: rich(c, "text") }} />;
  if (block.type === "statement") return <div className="mx-auto grid max-w-2xl gap-4 text-center"><span className="mx-auto h-1 w-44 rounded-full bg-violet" /><div className="text-2xl leading-snug text-ink" dangerouslySetInnerHTML={{ __html: rich(c, "text") }} /></div>;
  if (block.type === "image_text") return <div className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-md border border-line p-3"><img className="max-w-full" style={{ width: `${Number(c.imageSize) || 180}px` }} src={resolveAsset(c.imageUrl)} alt={c.imageAlt || ""} /><div><strong className="text-sm">{c.title}</strong><div className="rich-output mt-1.5 text-sm" dangerouslySetInnerHTML={{ __html: rich(c, "text") }} /></div></div>;
  if (block.type === "image_gallery") return <ImageGalleryPreview content={c} />;
  if (block.type === "flip_cards") return <FlipCardsPreview content={c} />;
  if (block.type === "accordion") return <AccordionPreview content={c} />;
  if (block.type === "list") return <ListPreview content={c} />;
  if (block.type === "embed") return <MediaBlock content={c} />;
  if (block.type === "custom_html") return <CustomHtmlFrame content={c} />;
  if (block.type === "divider") return <hr className="border-line" />;
  if (block.type === "continue_button") return <ContinueButtonPreview content={c} />;
  return <QuizPreview block={block} onStatusChange={onQuizStatusChange} />;
}

function imageHeightPx(content: Record<string, any>) {
  if (Number(content.imageHeight)) return Number(content.imageHeight);
  if (content.imageSize === "small") return 180;
  if (content.imageSize === "medium") return 300;
  if (content.imageSize === "full") return 620;
  return 420;
}

function ImageGalleryPreview({ content }: { content: Record<string, any> }) {
  const images = content.images || [];
  const [active, setActive] = useState(0);
  const hasMany = images.length > 1;
  const height = imageHeightPx(content);
  const frameClass = content.hasFrame === false ? "border-0 rounded-none" : "rounded-md border border-line bg-white p-2 shadow-sm";

  useEffect(() => {
    if (active > Math.max(images.length - 1, 0)) setActive(0);
  }, [active, images.length]);

  if (!images.length) return null;

  function move(direction: number) {
    setActive((current) => (current + direction + images.length) % images.length);
  }

  return (
    <div className="grid gap-3">
      {content.title ? <strong className="text-sm">{content.title}</strong> : null}
      <div className="group relative overflow-hidden rounded-md">
        <div className="grid place-items-center">
          {images.map((image: any, index: number) => (
            <img
              key={`${image.url}-${index}`}
              src={resolveAsset(image.url)}
              alt={image.alt || ""}
              style={{ maxHeight: `${height}px` }}
              className={`col-start-1 row-start-1 w-full object-contain transition-opacity duration-500 ease-out ${index === active ? "opacity-100" : "pointer-events-none opacity-0"} ${frameClass}`}
            />
          ))}
        </div>
        {hasMany ? (
          <>
            <button type="button" aria-label="Imagen anterior" onClick={() => move(-1)} className="absolute left-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-white/90 text-ink shadow-sm opacity-0 transition hover:bg-white group-hover:opacity-100">
              <ChevronLeft size={18} />
            </button>
            <button type="button" aria-label="Imagen siguiente" onClick={() => move(1)} className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-white/90 text-ink shadow-sm opacity-0 transition hover:bg-white group-hover:opacity-100">
              <ChevronRight size={18} />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function FlipCardsPreview({ content }: { content: Record<string, any> }) {
  return <div className="grid gap-3">{content.title ? <strong className="text-sm">{content.title}</strong> : null}<div className="grid gap-3 md:grid-cols-2">{(content.cards || []).map((card: any, index: number) => <details key={index} className="group rounded-md border border-line bg-white p-4 shadow-sm"><summary className="cursor-pointer list-none text-sm font-black text-ink">{card.front}</summary><p className="mt-3 text-sm leading-6 text-plum">{card.back}</p></details>)}</div></div>;
}

function AccordionPreview({ content }: { content: Record<string, any> }) {
  return <div className="grid gap-2">{content.title ? <strong className="text-sm">{content.title}</strong> : null}{(content.items || []).map((item: any, index: number) => <details key={index} className="rounded-md border border-line bg-white p-3"><summary className="cursor-pointer text-sm font-black text-ink">{item.title}</summary><p className="mt-2 text-sm leading-6 text-plum">{item.text}</p></details>)}</div>;
}

function ListPreview({ content }: { content: Record<string, any> }) {
  const Tag = content.listStyle === "number" ? "ol" : "ul";
  return <div className="grid gap-2">{content.title ? <strong className="text-sm">{content.title}</strong> : null}<Tag className={`grid gap-2 pl-5 text-sm leading-6 text-plum ${content.listStyle === "number" ? "list-decimal" : "list-disc"}`}>{(content.items || []).map((item: string, index: number) => <li key={index}>{item}</li>)}</Tag></div>;
}

function continueButtonClass(size = "medium") {
  if (size === "small") return "w-auto px-4";
  if (size === "full") return "w-full px-5";
  return "w-full max-w-xs px-5";
}

function ContinueButtonPreview({ content, disabled = false, onClick }: { content: Record<string, any>; disabled?: boolean; onClick?: () => void }) {
  const color = /^#[0-9a-fA-F]{6}$/.test(content.buttonColor || "") ? content.buttonColor : "#181833";
  return <div className="py-3 text-center"><button disabled={disabled} onClick={onClick} style={{ backgroundColor: color }} className={`rounded-md py-2.5 text-sm font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${continueButtonClass(content.buttonSize)}`}>{content.label || "Continuar"}</button></div>;
}

function customHtmlWidth(content: Record<string, any>) {
  const stored = Number(content.htmlWidth);
  if (!stored) return 400;
  if (stored === 520 && content.enableTailwind !== false) return 400;
  return Math.max(220, stored);
}

function customHtmlAlignmentStyle(content: Record<string, any>) {
  if (content.htmlAlign === "left") return { marginLeft: 0, marginRight: "auto" };
  if (content.htmlAlign === "right") return { marginLeft: "auto", marginRight: 0 };
  return { marginLeft: "auto", marginRight: "auto" };
}

function customHtmlVerticalJustify(content: Record<string, any>) {
  if (content.htmlVerticalAlign === "top") return "flex-start";
  if (content.htmlVerticalAlign === "bottom") return "flex-end";
  return "center";
}

function customHtmlSrcDoc(content: Record<string, any>, frameId: string) {
  const tailwind = content.enableTailwind === false ? "" : '<script src="https://cdn.tailwindcss.com"></script>';
  const verticalJustify = customHtmlVerticalJustify(content);
  return `<!doctype html>
<html>
<head>
  <base target="_blank">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${tailwind}
  <style>
    html,body{margin:0;min-height:100%;background:transparent;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
    body{display:flex;flex-direction:column;justify-content:${verticalJustify};min-height:100vh;overflow:hidden}
    #pulsestudio-html-root{width:100%}
    *,*::before,*::after{box-sizing:border-box}
  </style>
</head>
<body>
<main id="pulsestudio-html-root">${content.html || ""}</main>
<script>
  const measureHeight = () => {
    const root = document.getElementById("pulsestudio-html-root");
    if (!root) return 120;
    const rootRect = root.getBoundingClientRect();
    const children = [root, ...root.querySelectorAll("*")].filter((element) => !["SCRIPT","STYLE"].includes(element.tagName));
    return Math.ceil(children.reduce((height, element) => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      if (!rect.width && !rect.height) return height;
      return Math.max(height, rect.bottom - rootRect.top + parseFloat(styles.marginBottom || "0"));
    }, Math.max(root.scrollHeight, rootRect.height)) + 2);
  };
  const sendHeight = () => parent.postMessage({ type: "pulsestudio-html-height", id: "${frameId}", height: measureHeight() }, "*");
  window.addEventListener("load", sendHeight);
  document.querySelectorAll("img").forEach((image) => image.addEventListener("load", sendHeight));
  new ResizeObserver(sendHeight).observe(document.body);
  new ResizeObserver(sendHeight).observe(document.documentElement);
  document.addEventListener("click", (event) => {
    const link = event.target.closest && event.target.closest("a");
    if (!link) return;
    const href = link.getAttribute("href") || "";
    if (href === "#" || href.startsWith("#")) event.preventDefault();
  });
  setTimeout(sendHeight, 200);
  setTimeout(sendHeight, 800);
</script>
</body>
</html>`;
}

function CustomHtmlFrame({ content }: { content: Record<string, any> }) {
  const frameId = useMemo(() => uid("html-frame"), []);
  const [height, setHeight] = useState(Number(content.htmlHeight) || 420);
  const fixed = content.htmlSizing === "fixed";
  const fixedWidth = content.htmlWidthMode !== "full";
  const width = customHtmlWidth(content);

  useEffect(() => {
    if (fixed) {
      setHeight(Number(content.htmlHeight) || 420);
      return;
    }
    function onMessage(event: MessageEvent) {
      if (event.data?.type !== "pulsestudio-html-height" || event.data.id !== frameId) return;
      setHeight(Math.max(Number(content.htmlHeight) || 120, Math.min(Number(event.data.height) || 420, 2400)));
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [content.htmlHeight, fixed, frameId]);

  const iframe = (
    <iframe
      className={`w-full overflow-hidden bg-white ${content.hasFrame === false ? "border-0 rounded-none" : "rounded-md border border-line shadow-sm"}`}
      sandbox="allow-scripts allow-forms allow-popups"
      srcDoc={customHtmlSrcDoc(content, frameId)}
      style={{ height: `${fixed ? Number(content.htmlHeight) || 420 : height}px` }}
      title={content.title || "HTML custom"}
    />
  );
  return fixedWidth ? <div className="w-full" style={{ maxWidth: `${width}px`, ...customHtmlAlignmentStyle(content) }}>{iframe}</div> : iframe;
}

function QuizPreview({ block, onStatusChange }: { block: CourseBlock; onStatusChange?: (blockId: string, correct: boolean) => void }) {
  const c = block.content;
  const [singleAnswer, setSingleAnswer] = useState<number | null>(null);
  const [multipleAnswers, setMultipleAnswers] = useState<number[]>([]);
  const [blankAnswer, setBlankAnswer] = useState("");
  const [matchingAnswers, setMatchingAnswers] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState("");
  const options = c.options || [];
  const pairs = c.pairs || [];
  const matches = pairs.map((pair: any) => pair.match);

  function setMultiple(index: number, checked: boolean) {
    setFeedback("");
    setMultipleAnswers((current) => {
      const next = new Set(current);
      checked ? next.add(index) : next.delete(index);
      return [...next].sort((a, b) => a - b);
    });
  }

  function sameNumbers(a: number[], b: number[]) {
    return a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);
  }

  function review() {
    let correct = false;
    if (block.type === "quiz_single_choice") {
      correct = singleAnswer === c.correctAnswer;
      setFeedback(correct ? c.feedbackCorrect || "Correcto." : c.feedbackIncorrect || "Revisa la respuesta.");
      onStatusChange?.(block.id, correct);
      return;
    }
    if (block.type === "quiz_multiple_response") {
      correct = sameNumbers(multipleAnswers, c.correctAnswers || []);
      setFeedback(correct ? c.feedbackCorrect || "Correcto." : c.feedbackIncorrect || "Revisa las alternativas.");
      onStatusChange?.(block.id, correct);
      return;
    }
    if (block.type === "quiz_fill_blank") {
      const expected = (c.answers || []).map((answer: string) => c.caseSensitive ? answer.trim() : answer.trim().toLowerCase());
      const given = c.caseSensitive ? blankAnswer.trim() : blankAnswer.trim().toLowerCase();
      correct = expected.includes(given);
      setFeedback(correct ? c.feedbackCorrect || "Correcto." : c.feedbackIncorrect || "Revisa la respuesta.");
      onStatusChange?.(block.id, correct);
      return;
    }
    if (block.type === "quiz_matching") {
      correct = pairs.every((pair: any, index: number) => matchingAnswers[index] === pair.match);
      setFeedback(correct ? c.feedbackCorrect || "Correcto." : c.feedbackIncorrect || "Revisa las coincidencias.");
      onStatusChange?.(block.id, correct);
    }
  }

  if (block.type === "quiz_fill_blank") {
    return <article className="rounded-md border border-line p-4"><strong className="text-base">{c.question}</strong><p className="mt-3 text-sm">{c.prompt}</p><input value={blankAnswer} onChange={(event) => { setBlankAnswer(event.target.value); setFeedback(""); }} className="mt-3 h-9 w-full rounded-md border border-line px-3 text-sm outline-none focus:border-violet" /><QuizActions feedback={feedback} onReview={review} /></article>;
  }
  if (block.type === "quiz_matching") {
    return <article className="rounded-md border border-line p-4"><strong className="text-base">{c.question}</strong><div className="mt-3 grid max-w-3xl gap-2">{pairs.map((pair: any, index: number) => <div className="grid grid-cols-[130px_1fr] items-center gap-3 rounded-md border border-violet/20 bg-[#fbfbff] p-2.5" key={index}><span className="text-sm font-bold">{pair.prompt}</span><select value={matchingAnswers[index] || ""} onChange={(event) => { setMatchingAnswers((current) => ({ ...current, [index]: event.target.value })); setFeedback(""); }} className="h-9 rounded-md border border-line px-2 text-sm outline-none focus:border-violet"><option value="">Selecciona</option>{matches.map((match: string) => <option key={match} value={match}>{match}</option>)}</select></div>)}</div><QuizActions feedback={feedback} onReview={review} /></article>;
  }
  return <article className="rounded-md border border-line p-4"><strong className="text-base">{c.question}</strong><div className="mt-3 grid gap-2">{options.map((option: string, index: number) => {
    const multiple = block.type === "quiz_multiple_response";
    const checked = multiple ? multipleAnswers.includes(index) : singleAnswer === index;
    return <label key={index} className="quiz-option grid grid-cols-[16px_1fr] items-center gap-2.5 rounded-md border border-violet/20 bg-[#fbfbff] p-3"><input name={block.id} type={multiple ? "checkbox" : "radio"} checked={checked} onChange={(event) => multiple ? setMultiple(index, event.target.checked) : (setSingleAnswer(index), setFeedback(""))} /><span className="text-sm font-semibold">{option}</span></label>;
  })}</div><QuizActions feedback={feedback} onReview={review} /></article>;
}

function QuizActions({ feedback, onReview }: { feedback: string; onReview: () => void }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button onClick={onReview} className="rounded-md bg-mist px-4 py-2 text-sm font-extrabold">Revisar</button>
      {feedback ? <p className={`text-sm font-extrabold ${feedback.toLowerCase().startsWith("correct") ? "text-violet" : "text-red-600"}`}>{feedback}</p> : null}
    </div>
  );
}

function PreviewApp() {
  const [course, setCourse] = useState<Course | null>(null);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [revealedScreens, setRevealedScreens] = useState<Record<string, number>>({});
  const [correctQuestions, setCorrectQuestions] = useState<Record<string, boolean>>({});
  useEffect(() => {
    loadCourseById(getCourseId()).then(setCourse);
  }, []);
  if (!course) return <div className="grid min-h-screen place-items-center text-sm font-bold text-steel">Cargando vista previa...</div>;
  const lesson = course.lessons[lessonIndex] || course.lessons[0];
  const map = blockScreenMap(lesson);
  const revealedScreen = Math.min(revealedScreens[lesson.id] || 0, screenCount(lesson) - 1);
  const unitProgress = progressForLesson(lesson, revealedScreen, correctQuestions);
  const totalProgress = Math.round(course.lessons.reduce((sum, item, index) => {
    if (index < lessonIndex) return sum + 100;
    if (index > lessonIndex) return sum;
    return sum + unitProgress;
  }, 0) / Math.max(course.lessons.length, 1));

  function canContinue(screen: number) {
    return lesson.blocks.every((block, index) => {
      if (!isQuestionType(block.type) || block.content.required === false || map[index] !== screen) return true;
      return correctQuestions[block.id] === true;
    });
  }

  function canFinishLesson() {
    return lesson.blocks.every((block) => !isQuestionType(block.type) || block.content.required === false || correctQuestions[block.id] === true);
  }

  function revealNext() {
    setRevealedScreens((current) => ({ ...current, [lesson.id]: Math.min(revealedScreen + 1, screenCount(lesson) - 1) }));
    window.setTimeout(() => window.scrollBy({ top: 220, behavior: "smooth" }), 40);
  }

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] bg-white">
      <aside className="sticky top-0 h-screen overflow-y-auto border-r border-line bg-white">
        <div className="bg-gradient-to-br from-plum to-ink p-6 text-white"><p className="text-[11px] font-black uppercase tracking-[0.12em]">Course preview</p><h1 className="mt-5 text-2xl font-black">{course.title}</h1><p className="mt-6 text-xs font-black">CURSO {totalProgress}%</p><div className="mt-3 h-1 bg-white/35"><i className="block h-full bg-white" style={{ width: `${totalProgress}%` }} /></div><p className="mt-5 text-xs font-black">UNIDAD {unitProgress}%</p><div className="mt-3 h-1 bg-white/35"><i className="block h-full bg-violet" style={{ width: `${unitProgress}%` }} /></div></div>
        <nav className="grid gap-1.5 p-4">{course.lessons.map((item, index) => <button key={item.id} onClick={() => setLessonIndex(index)} className={`grid grid-cols-[24px_1fr_auto] items-center gap-2 rounded-md px-2.5 py-2 text-left ${index === lessonIndex ? "bg-mist" : ""}`}><span className="grid size-5 place-items-center rounded-full border border-line text-xs font-bold">{index + 1}</span><strong className="truncate text-sm">{item.title}</strong><small className="text-[11px] font-bold text-steel">{index <= lessonIndex ? "Disponible" : "Bloqueada"}</small></button>)}</nav>
      </aside>
      <main className="p-8"><a className="mb-7 inline-flex rounded-md border border-line px-4 py-2 text-sm font-extrabold" href={`${appRoute("/")}?course=${course.id}`}>Volver al editor</a><section className="mx-auto max-w-5xl"><p className="text-xs font-black uppercase tracking-[0.12em] text-violet">Unidad {lessonIndex + 1} de {course.lessons.length}</p><h2 className="mb-7 text-4xl font-black tracking-[-0.04em]">{lesson.title}</h2><div className="grid gap-6">{lesson.blocks.map((block, index) => {
        if (map[index] > revealedScreen) return null;
        if (block.type === "continue_button") {
          if (map[index] !== revealedScreen || revealedScreen >= screenCount(lesson) - 1) return null;
          const enabled = canContinue(map[index]);
          return <FadeInOnView key={block.id}><BlockContentFrame block={block}><ContinueButtonPreview content={block.content} disabled={!enabled} onClick={revealNext} /></BlockContentFrame></FadeInOnView>;
        }
        return <FadeInOnView key={block.id}><BlockContentFrame block={block}><BlockPreview block={block} onQuizStatusChange={(id, correct) => setCorrectQuestions((current) => ({ ...current, [id]: correct }))} /></BlockContentFrame></FadeInOnView>;
      })}</div>{revealedScreen >= screenCount(lesson) - 1 && lessonIndex < course.lessons.length - 1 ? <div className="mt-8 text-center"><button disabled={!canFinishLesson()} onClick={() => canFinishLesson() && setLessonIndex(lessonIndex + 1)} className="w-full max-w-sm rounded-md bg-ink px-5 py-3 font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">Ir a la siguiente unidad</button></div> : null}</section></main>
    </div>
  );
}

function FadeInOnView({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.15 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={visible ? "fade-up" : "fade-pending"}>{children}</div>;
}

function resolveAsset(url = "") {
  if (url.startsWith("assets/")) return `runtime-assets/${url.replace("assets/", "")}`;
  return url;
}

function embedUrl(url = "") {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return `https://www.youtube.com/embed/${parsed.pathname.replace("/", "")}`;
    if (host === "youtube.com" || host === "m.youtube.com") {
      const videoId = parsed.searchParams.get("v");
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
  } catch {
    return url;
  }
}

function MediaBlock({ content }: { content: Record<string, any> }) {
  const url = embedUrl(content.url || "");
  return <div className="grid gap-3"><strong>{content.title}</strong><iframe className="aspect-video w-full rounded-lg border border-line bg-ink p-2" src={url} allowFullScreen loading="lazy" /><p className="text-sm text-steel">{content.caption}</p></div>;
}

function moveItem<T>(list: T[], index: number, direction: number) {
  const target = index + direction;
  if (target < 0 || target >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(target, 0, item);
}

function moveLesson(list: Lesson[], index: number, direction: number, setLessonIndex: (index: number) => void) {
  moveItem(list, index, direction);
  setLessonIndex(Math.max(0, Math.min(list.length - 1, index + direction)));
}

createRoot(document.getElementById("root")!).render(<App />);
