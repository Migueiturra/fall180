import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Eye,
  FileQuestion,
  Image,
  LayoutDashboard,
  ListChecks,
  PanelLeft,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  Video
} from "lucide-react";
import "./styles.css";

type BlockType =
  | "heading"
  | "paragraph"
  | "image_text"
  | "statement"
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

const blockTools: Array<{ type: BlockType; label: string; icon: React.ReactNode }> = [
  { type: "heading", label: "Titulo", icon: <BookOpen size={15} /> },
  { type: "paragraph", label: "Parrafo", icon: <PanelLeft size={15} /> },
  { type: "image_text", label: "Imagen", icon: <Image size={15} /> },
  { type: "statement", label: "Statement", icon: <Copy size={15} /> },
  { type: "embed", label: "Embed", icon: <Video size={15} /> },
  { type: "custom_html", label: "HTML", icon: <Code2 size={15} /> },
  { type: "quiz_single_choice", label: "Opcion unica", icon: <FileQuestion size={15} /> },
  { type: "quiz_multiple_response", label: "Multiple", icon: <ListChecks size={15} /> },
  { type: "quiz_fill_blank", label: "Completar", icon: <Pencil size={15} /> },
  { type: "quiz_matching", label: "Coincidencia", icon: <ChevronRight size={15} /> },
  { type: "continue_button", label: "Continuar", icon: <ChevronRight size={15} /> },
  { type: "divider", label: "Separador", icon: <PanelLeft size={15} /> }
];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function getCourseId() {
  return new URLSearchParams(window.location.search).get("course") || "curso-demo-scorm";
}

function htmlToText(value = "") {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = value;
  return wrapper.textContent || "";
}

function rich(content: Record<string, any>, field: string) {
  return content[`${field}Html`] || content[field] || "";
}

function defaultBlock(type: BlockType): CourseBlock {
  if (type === "heading") return { id: uid("b"), type, content: { text: "Nuevo titulo", textHtml: "Nuevo titulo" } };
  if (type === "paragraph") return { id: uid("b"), type, content: { text: "Escribe aqui el contenido.", textHtml: "Escribe aqui el contenido." } };
  if (type === "image_text") {
    return { id: uid("b"), type, content: { imageUrl: "assets/demo-learning.svg", imageAlt: "Imagen", title: "Titulo del bloque", text: "Descripcion asociada.", textHtml: "Descripcion asociada." } };
  }
  if (type === "statement") return { id: uid("b"), type, content: { text: "You're the master of your life. Steer it with intention.", textHtml: "You're the master of your life. Steer it with intention.", showDivider: true, width: "normal" } };
  if (type === "embed") return { id: uid("b"), type, content: { title: "Video o recurso embebido", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", caption: "", size: "wide", aspectRatio: "16 / 9", hasFrame: true } };
  if (type === "custom_html") return { id: uid("b"), type, content: { title: "Contenido HTML custom", html: "<div style='padding:24px;text-align:center'><h2>Bloque HTML</h2><p>Escribe tu codigo.</p></div>", size: "wide", aspectRatio: "16 / 9", hasFrame: true } };
  if (type === "quiz_single_choice") return { id: uid("b"), type, content: { question: "Escribe la pregunta", options: ["Alternativa correcta", "Alternativa incorrecta"], correctAnswer: 0, required: true, feedbackCorrect: "Correcto.", feedbackIncorrect: "Revisa la respuesta." } };
  if (type === "quiz_multiple_response") return { id: uid("b"), type, content: { question: "Selecciona todas las alternativas correctas", options: ["Respuesta correcta", "Otra respuesta correcta", "Distractor"], correctAnswers: [0, 1], required: true, feedbackCorrect: "Correcto.", feedbackIncorrect: "Revisa las alternativas." } };
  if (type === "quiz_fill_blank") return { id: uid("b"), type, content: { question: "Completa la frase", prompt: "La pieza que reconoce el LMS es el archivo ____.", answers: ["imsmanifest.xml"], caseSensitive: false, required: true, feedbackCorrect: "Correcto.", feedbackIncorrect: "Revisa la respuesta." } };
  if (type === "quiz_matching") return { id: uid("b"), type, content: { question: "Relaciona cada concepto con su descripcion", pairs: [{ prompt: "SCORM", match: "Paquete que conversa con el LMS" }, { prompt: "Manifest", match: "Archivo que describe el contenido" }], required: true, feedbackCorrect: "Correcto.", feedbackIncorrect: "Revisa las coincidencias." } };
  if (type === "continue_button") return { id: uid("b"), type, content: { label: "Continuar" } };
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
    <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-line bg-white/90 px-6 backdrop-blur-xl">
      <a className="flex items-center gap-3 no-underline" href="/courses.html">
        <span className="grid size-5 place-items-center rounded-full bg-violet/20">
          <span className="size-2 rounded-full bg-violet" />
        </span>
        <strong className="text-lg text-ink">Fall 180</strong>
      </a>
      <nav className="flex items-center gap-6 text-sm font-extrabold text-ink">
        <a className={section === "dashboard" ? "border-b-2 border-violet pb-2" : "pb-2"} href="/courses.html">Dashboard</a>
        <a className={section === "editor" ? "border-b-2 border-violet pb-2" : "pb-2"} href="/">Editor</a>
        <a className={section === "preview" ? "border-b-2 border-violet pb-2" : "pb-2"} href={`/preview.html?course=${getCourseId()}`}>Preview</a>
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
    const response = await fetch("/api/courses");
    if (response.ok) {
      const result = await response.json();
      setCourses(result.courses || []);
      return;
    }
    const fallback = await fetch("/api/course");
    const course = await fallback.json();
    setCourses([{ id: course.id || "curso-demo-scorm", title: course.title, description: course.description, lessons: course.lessons?.length || 0 }]);
  }

  async function createCourse() {
    const response = await fetch("/api/courses", { method: "POST" });
    const result = await response.json();
    if (result.ok) window.location.href = `/?course=${encodeURIComponent(result.course.id)}`;
  }

  async function deleteCourse() {
    if (!deleteTarget) return;
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
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-6">
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
  return (
    <article className="overflow-hidden rounded-lg border border-line bg-white shadow-soft transition hover:-translate-y-0.5 hover:border-violet/50">
      <div className={`flex h-36 items-end p-5 ${covers[index % covers.length]}`}>
        <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-white">Course</span>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 text-xs font-bold text-steel"><span className="grid size-5 place-items-center rounded-full bg-violet/15 text-violet">F</span> Fall 180 Studio</div>
        <h2 className="mt-3 text-xl font-black leading-tight tracking-[-0.03em] text-ink">{course.title}</h2>
        <p className="mt-2 min-h-12 text-sm leading-relaxed text-steel">{course.description}</p>
        <div className="my-4 grid gap-1 text-xs font-bold text-steel"><span>Course · {course.lessons} Lessons</span><span>Updated today</span></div>
        <div className="flex flex-wrap gap-2">
          <a className="rounded-md border border-line px-3 py-2 text-sm font-extrabold" href={`/?course=${course.id}`}>Editar</a>
          <a className="rounded-md border border-line px-3 py-2 text-sm font-extrabold" href={`/preview.html?course=${course.id}`}>Preview</a>
          <button className="rounded-md border border-red-100 px-3 py-2 text-sm font-extrabold text-red-600" onClick={onDelete}><Trash2 size={14} /></button>
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
    const response = await fetch(`/api/course?id=${encodeURIComponent(courseId)}`);
    const loaded = await response.json();
    setCourse(loaded);
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
    const response = await fetch(`/api/course?id=${encodeURIComponent(course.id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(course)
    });
    const result = await response.json();
    if (!result.ok) {
      setToast(result.error || "No se pudo guardar.");
      return false;
    }
    setDirty(false);
    setToast("Curso guardado.");
    window.setTimeout(() => setToast(""), 2200);
    return true;
  }

  async function exportScorm() {
    if (dirty) {
      const saved = await save();
      if (!saved) return;
    }
    const response = await fetch(`/api/export?id=${encodeURIComponent(course?.id || courseId)}`, { method: "POST" });
    const result = await response.json();
    if (result.ok) window.location.href = result.zipUrl;
  }

  if (!course) return <div className="grid min-h-screen place-items-center text-sm font-bold text-steel">Cargando editor...</div>;

  const lesson = course.lessons[lessonIndex] || course.lessons[0];
  const editingBlock = lesson?.blocks.find((block) => block.id === editingBlockId) || null;

  return (
    <Tooltip.Provider>
      <AppHeader section="editor" />
      <div className="fixed right-6 top-5 z-40 flex gap-2">
        <span className="grid h-10 place-items-center rounded-full border border-line bg-white px-4 text-xs font-extrabold text-ink">{dirty ? "Sin guardar" : "Guardado"}</span>
        <a className="grid h-10 place-items-center rounded-md border border-line bg-white px-4 text-sm font-extrabold" href={`/courses.html`}>Cursos</a>
        <a className="grid h-10 place-items-center rounded-md border border-line bg-white px-4 text-sm font-extrabold" href={`/preview.html?course=${course.id}`}>Vista previa</a>
        <button onClick={save} className="inline-flex h-10 items-center gap-2 rounded-md bg-mist px-4 text-sm font-extrabold"><Save size={16} /> Guardar</button>
        <button onClick={exportScorm} className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-sm font-extrabold text-white"><Upload size={16} /> Exportar SCORM</button>
      </div>
      <main className="grid min-h-[calc(100vh-76px)] grid-cols-[340px_minmax(0,1fr)] gap-5 bg-[#f0f0f8] p-5">
        <aside className="rounded-xl bg-white p-5 shadow-soft">
          <section className="rounded-lg border border-line bg-white p-4">
            <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">Curso</h2>
            <Field label="Titulo" value={course.title} onChange={(value) => updateCourse((draft) => { draft.title = value; })} />
            <TextField label="Descripcion" value={course.description} onChange={(value) => updateCourse((draft) => { draft.description = value; })} rows={4} />
            <Field label="Puntaje minimo" type="number" value={String(course.scorm?.passingScore || 70)} onChange={(value) => updateCourse((draft) => { draft.scorm = draft.scorm || {}; draft.scorm.passingScore = Number(value); })} />
          </section>
          <section className="mt-7">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-[-0.03em] text-ink">Lecciones</h2>
              <button className="rounded-md bg-mist px-3 py-2 text-sm font-extrabold" onClick={() => updateCourse((draft) => {
                draft.lessons.push({ id: uid("lesson"), title: `Nueva leccion ${draft.lessons.length + 1}`, blocks: [defaultBlock("heading"), defaultBlock("paragraph")] });
                setLessonIndex(draft.lessons.length - 1);
              })}>Agregar</button>
            </div>
            <div className="grid gap-2">
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
        <section className="rounded-xl bg-white p-6 shadow-soft">
          <div className="mb-5 flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-violet">Editor</p>
              <input value={lesson.title} onChange={(event) => updateCourse((draft) => { draft.lessons[lessonIndex].title = event.target.value; })} className="mt-1 w-full border-0 bg-transparent text-2xl font-black tracking-[-0.03em] text-ink outline-none" />
            </div>
            <div className="flex max-w-[650px] flex-wrap justify-end gap-2 rounded-lg border border-line bg-mist p-2">
              {blockTools.map((tool) => <button key={tool.type} onClick={() => updateCourse((draft) => {
                const block = defaultBlock(tool.type);
                draft.lessons[lessonIndex].blocks.push(block);
                setEditingBlockId(block.id);
              })} className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-black hover:bg-white">{tool.icon}{tool.label}</button>)}
            </div>
          </div>
          <div className="grid gap-4">
            {lesson.blocks.map((block, index) => (
              <BlockShell key={block.id} block={block} editing={block.id === editingBlockId} onEdit={() => setEditingBlockId(block.id)} onSave={async () => { await save(); setEditingBlockId(null); }} onMove={(direction) => updateCourse((draft) => moveItem(draft.lessons[lessonIndex].blocks, index, direction))} onDelete={() => updateCourse((draft) => {
                draft.lessons[lessonIndex].blocks.splice(index, 1);
                setEditingBlockId(null);
              })} onChange={(content) => updateCourse((draft) => { draft.lessons[lessonIndex].blocks[index].content = content; })} />
            ))}
          </div>
        </section>
      </main>
      {toast ? <div className="fixed bottom-5 right-5 rounded-lg bg-ink px-5 py-3 text-sm font-bold text-white shadow-soft">{toast}</div> : null}
    </Tooltip.Provider>
  );
}

function LessonRow({ lesson, active, onSelect, onMove, onDelete }: { lesson: Lesson; active: boolean; onSelect: () => void; onMove: (direction: number) => void; onDelete: () => void }) {
  return (
    <article className={`grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border px-3 py-2 ${active ? "border-violet bg-mist" : "border-line bg-white"}`}>
      <button onClick={onSelect} className="truncate text-left text-[15px] font-medium text-ink">{lesson.title}</button>
      <div className="flex gap-1">
        <IconButton label="Subir" onClick={() => onMove(-1)}><ArrowUp size={14} /></IconButton>
        <IconButton label="Bajar" onClick={() => onMove(1)}><ArrowDown size={14} /></IconButton>
        <IconButton label="Borrar" danger onClick={onDelete}><Trash2 size={14} /></IconButton>
      </div>
    </article>
  );
}

function IconButton({ label, onClick, children, danger = false }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button aria-label={label} onClick={onClick} className={`grid size-7 place-items-center rounded-md border border-transparent ${danger ? "text-red-600 hover:bg-red-50" : "text-steel hover:bg-white hover:text-ink"}`}>{children}</button>
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

function BlockShell({ block, editing, onEdit, onSave, onMove, onDelete, onChange }: { block: CourseBlock; editing: boolean; onEdit: () => void; onSave: () => void; onMove: (direction: number) => void; onDelete: () => void; onChange: (content: Record<string, any>) => void }) {
  return (
    <article className={`grid grid-cols-[82px_minmax(0,1fr)_auto] overflow-hidden rounded-lg border ${editing ? "border-violet bg-white shadow-soft" : "border-line bg-white"}`}>
      <button onClick={onEdit} className={`border-r border-line text-xs font-black ${editing ? "bg-mist text-ink" : "text-violet hover:bg-mist"}`}>Editar</button>
      <div className="p-5">
        {editing ? <BlockForm block={block} onChange={onChange} /> : <BlockPreview block={block} />}
      </div>
      <div className="flex items-center gap-1 p-4">
        <IconButton label="Subir" onClick={() => onMove(-1)}><ArrowUp size={14} /></IconButton>
        <IconButton label="Bajar" onClick={() => onMove(1)}><ArrowDown size={14} /></IconButton>
        <IconButton label="Borrar" danger onClick={onDelete}><Trash2 size={14} /></IconButton>
      </div>
      {editing ? <div className="col-span-3 flex justify-end border-t border-line p-4"><button onClick={onSave} className="inline-flex h-9 items-center gap-2 rounded-md bg-ink px-4 text-sm font-extrabold text-white"><Save size={15} /> Guardar bloque</button></div> : null}
    </article>
  );
}

function RichTextarea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (html: string) => void; rows?: number }) {
  return (
    <div className="grid gap-2">
      <span className="text-xs font-extrabold text-steel">{label}</span>
      <div className="flex gap-1">
        {colors.map((color) => <button key={color} type="button" onClick={() => onChange(`<span style="color:${color}">${htmlToText(value)}</span>`)} className="size-7 rounded-full border border-line" style={{ background: color }} />)}
      </div>
      <textarea rows={rows} value={htmlToText(value)} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-line p-3 text-sm font-semibold text-ink outline-none focus:border-violet" />
    </div>
  );
}

function BlockForm({ block, onChange }: { block: CourseBlock; onChange: (content: Record<string, any>) => void }) {
  const c = block.content;
  const patch = (next: Record<string, any>) => onChange({ ...c, ...next });

  if (block.type === "heading" || block.type === "paragraph") return <RichTextarea label="Texto" value={rich(c, "text")} onChange={(html) => patch({ textHtml: html, text: htmlToText(html) })} rows={block.type === "heading" ? 2 : 7} />;
  if (block.type === "statement") return <div className="grid gap-4"><RichTextarea label="Statement" value={rich(c, "text")} onChange={(html) => patch({ textHtml: html, text: htmlToText(html) })} rows={5} /><SelectField label="Ancho" value={c.width || "normal"} onChange={(value) => patch({ width: value })} options={[["narrow", "Estrecho"], ["normal", "Normal"], ["wide", "Ancho"]]} /></div>;
  if (block.type === "image_text") return <div className="grid gap-4"><Field label="URL imagen" value={c.imageUrl || ""} onChange={(value) => patch({ imageUrl: value })} /><Field label="Titulo" value={c.title || ""} onChange={(value) => patch({ title: value })} /><RichTextarea label="Texto" value={rich(c, "text")} onChange={(html) => patch({ textHtml: html, text: htmlToText(html) })} /></div>;
  if (block.type === "embed") return <div className="grid gap-4"><Field label="Titulo" value={c.title || ""} onChange={(value) => patch({ title: value })} /><Field label="URL" value={c.url || ""} onChange={(value) => patch({ url: value })} /><Field label="Bajada" value={c.caption || ""} onChange={(value) => patch({ caption: value })} /></div>;
  if (block.type === "custom_html") return <div className="grid gap-4"><Field label="Titulo" value={c.title || ""} onChange={(value) => patch({ title: value })} /><TextField label="Codigo HTML" value={c.html || ""} onChange={(value) => patch({ html: value })} rows={9} /></div>;
  if (block.type === "continue_button") return <Field label="Texto del boton" value={c.label || "Continuar"} onChange={(value) => patch({ label: value })} />;
  if (block.type === "divider") return <p className="text-sm font-bold text-steel">Este bloque no necesita configuracion.</p>;
  return <QuizForm block={block} onChange={onChange} />;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="grid gap-2 text-xs font-extrabold text-steel">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border border-line px-3 text-sm font-semibold text-ink">{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
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

function BlockPreview({ block }: { block: CourseBlock }) {
  const c = block.content;
  if (block.type === "heading") return <h3 className="text-3xl font-black tracking-[-0.04em]" dangerouslySetInnerHTML={{ __html: rich(c, "text") }} />;
  if (block.type === "paragraph") return <div className="rich-output text-base leading-8 text-plum" dangerouslySetInnerHTML={{ __html: rich(c, "text") }} />;
  if (block.type === "statement") return <div className="mx-auto grid max-w-2xl gap-6 text-center"><span className="mx-auto h-1 w-56 rounded-full bg-violet" /><div className="text-3xl leading-snug text-ink" dangerouslySetInnerHTML={{ __html: rich(c, "text") }} /></div>;
  if (block.type === "image_text") return <div className="grid grid-cols-[140px_1fr] items-center gap-5 rounded-lg border border-line p-4"><img className="max-w-full" src={resolveAsset(c.imageUrl)} alt={c.imageAlt || ""} /><div><strong>{c.title}</strong><div className="rich-output mt-2" dangerouslySetInnerHTML={{ __html: rich(c, "text") }} /></div></div>;
  if (block.type === "embed") return <MediaBlock content={c} />;
  if (block.type === "custom_html") return <iframe className="min-h-56 w-full rounded-lg border border-line" sandbox="allow-scripts allow-forms allow-popups" srcDoc={c.html || ""} />;
  if (block.type === "divider") return <hr className="border-line" />;
  if (block.type === "continue_button") return <div className="rounded-lg border border-dashed border-violet/40 bg-mist p-5 text-center"><button className="rounded-md bg-ink px-5 py-3 font-extrabold text-white">{c.label || "Continuar"}</button></div>;
  return <QuizPreview block={block} />;
}

function QuizPreview({ block }: { block: CourseBlock }) {
  const c = block.content;
  if (block.type === "quiz_fill_blank") return <article className="rounded-lg border border-line p-5"><strong className="text-xl">{c.question}</strong><p className="mt-4 text-lg">{c.prompt}</p><input disabled className="mt-4 h-12 w-full rounded-md border border-line" /><button className="mt-5 rounded-md bg-mist px-5 py-3 font-extrabold">Revisar</button></article>;
  if (block.type === "quiz_matching") return <article className="rounded-lg border border-line p-5"><strong className="text-xl">{c.question}</strong><div className="mt-4 grid max-w-3xl gap-3">{(c.pairs || []).map((pair: any, index: number) => <div className="grid grid-cols-[180px_1fr] items-center gap-4 rounded-md border border-violet/20 bg-[#fbfbff] p-4" key={index}><span className="font-bold">{pair.prompt}</span><select className="h-11 rounded-md border border-line px-3"><option>{pair.match}</option></select></div>)}</div><button className="mt-5 rounded-md bg-mist px-5 py-3 font-extrabold">Revisar</button></article>;
  return <article className="rounded-lg border border-line p-5"><strong className="text-xl">{c.question}</strong><div className="mt-4 grid gap-3">{(c.options || []).map((option: string, index: number) => <label key={index} className="quiz-option grid grid-cols-[18px_1fr] items-center gap-3 rounded-md border border-violet/20 bg-[#fbfbff] p-4"><input type={block.type === "quiz_multiple_response" ? "checkbox" : "radio"} readOnly /><span className="font-semibold">{option}</span></label>)}</div><button className="mt-5 rounded-md bg-mist px-5 py-3 font-extrabold">Revisar</button></article>;
}

function PreviewApp() {
  const [course, setCourse] = useState<Course | null>(null);
  const [lessonIndex, setLessonIndex] = useState(0);
  useEffect(() => {
    fetch(`/api/course?id=${getCourseId()}`).then((response) => response.json()).then(setCourse);
  }, []);
  if (!course) return <div className="grid min-h-screen place-items-center text-sm font-bold text-steel">Cargando vista previa...</div>;
  const lesson = course.lessons[lessonIndex] || course.lessons[0];
  return (
    <div className="grid min-h-screen grid-cols-[300px_1fr] bg-white">
      <aside className="border-r border-line">
        <div className="bg-gradient-to-br from-plum to-ink p-8 text-white"><p className="text-xs font-black uppercase tracking-[0.12em]">Course preview</p><h1 className="mt-6 text-3xl font-black">{course.title}</h1><p className="mt-7 text-sm font-black">50% COMPLETE</p><div className="mt-3 h-1 bg-white/35"><i className="block h-full w-1/2 bg-white" /></div></div>
        <nav className="grid gap-2 p-5">{course.lessons.map((item, index) => <button key={item.id} onClick={() => setLessonIndex(index)} className={`grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-md px-3 py-3 text-left ${index === lessonIndex ? "bg-mist" : ""}`}><span className="grid size-6 place-items-center rounded-full border border-line text-sm font-bold">{index + 1}</span><strong>{item.title}</strong><small className="font-bold text-steel">{index <= lessonIndex ? "Disponible" : "Bloqueada"}</small></button>)}</nav>
      </aside>
      <main className="p-10"><a className="mb-8 inline-flex rounded-md border border-line px-4 py-2 font-extrabold" href={`/?course=${course.id}`}>Volver al editor</a><section className="mx-auto max-w-5xl"><p className="text-xs font-black uppercase tracking-[0.12em] text-violet">Unidad {lessonIndex + 1} de {course.lessons.length}</p><h2 className="mb-8 text-4xl font-black tracking-[-0.04em]">{lesson.title}</h2><div className="grid gap-7">{lesson.blocks.map((block) => <div className="fade-up" key={block.id}><BlockPreview block={block} /></div>)}</div>{lessonIndex < course.lessons.length - 1 ? <div className="mt-8 rounded-lg border border-dashed border-violet/40 bg-mist p-6 text-center"><button onClick={() => setLessonIndex(lessonIndex + 1)} className="rounded-md bg-ink px-5 py-3 font-extrabold text-white">Ir a la siguiente unidad</button></div> : null}</section></main>
    </div>
  );
}

function resolveAsset(url = "") {
  if (url.startsWith("assets/")) return `/runtime-assets/${url.replace("assets/", "")}`;
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
