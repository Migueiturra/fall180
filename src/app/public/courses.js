const grid = document.getElementById("course-grid");
const search = document.getElementById("course-search");
const createButtons = document.querySelectorAll("[data-create-course]");

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function courseCard(course, index) {
  var covers = ["cover-violet", "cover-slate", "cover-graphite", "cover-deep"];
  return `
    <article class="course-card" data-course-card="${escapeHtml(course.id)}">
      <div class="course-card-cover ${covers[index % covers.length]}">
        <span>COURSE</span>
      </div>
      <div class="course-card-body">
        <div class="course-author"><span>P</span> PulseStudio</div>
        <h2>${escapeHtml(course.title)}</h2>
        <p>${escapeHtml(course.description)}</p>
        <div class="course-meta">
          <span>Course &middot; ${course.lessons} Lessons</span>
          <span>Updated today</span>
        </div>
        <div class="course-actions">
          <a class="button ghost" href="/?course=${encodeURIComponent(course.id)}">Editar</a>
          <a class="button ghost" href="/preview.html?course=${encodeURIComponent(course.id)}">Preview</a>
          <button class="ghost danger subtle-danger" type="button" data-delete-course="${escapeHtml(course.id)}" data-course-title="${escapeHtml(course.title)}">Eliminar</button>
        </div>
      </div>
    </article>
  `;
}

async function loadCourses() {
  const result = await loadCourseList();
  const term = (search?.value || "").trim().toLowerCase();
  const courses = (result.courses || []).filter((course) => {
    return !term || course.title.toLowerCase().includes(term) || course.description.toLowerCase().includes(term);
  });

  grid.innerHTML = courses.length
    ? courses.map(courseCard).join("")
    : `<p class="empty-state">No hay cursos para mostrar.</p>`;
}

async function loadCourseList() {
  const response = await fetch("/api/courses");
  if (response.ok) return response.json();

  const fallback = await fetch("/api/course");
  if (!fallback.ok) return { ok: false, courses: [] };
  const course = await fallback.json();
  return {
    ok: true,
    courses: [{
      id: course.id || "curso-demo-scorm",
      title: course.title || "Curso sin titulo",
      description: course.description || "",
      lessons: Array.isArray(course.lessons) ? course.lessons.length : 0
    }]
  };
}

async function createCourse() {
  const response = await fetch("/api/courses", { method: "POST" });
  const result = response.ok ? await response.json() : await createFallbackCourse();
  if (!result.ok) {
    window.alert(result.error || "No se pudo crear el curso.");
    return;
  }
  window.location.href = `/?course=${encodeURIComponent(result.course.id)}`;
}

async function createFallbackCourse() {
  const id = `nuevo-curso-${Date.now()}`;
  const course = {
    id,
    title: "Nuevo curso",
    description: "Describe el objetivo de este curso.",
    metadata: { language: "es", version: "0.1.0" },
    theme: { primaryColor: "#8182F2", accentColor: "#3C3C59" },
    scorm: {
      version: "SCORM_1.2",
      passingScore: 70,
      completionRule: "view_all_blocks",
      reporting: "score_and_completion"
    },
    lessons: [{
      id: `lesson-${Date.now()}`,
      title: "Bienvenida",
      blocks: [
        { id: `b-${Date.now()}-1`, type: "heading", content: { text: "Bienvenida", textHtml: "Bienvenida" } },
        { id: `b-${Date.now()}-2`, type: "paragraph", content: { text: "Escribe aqui el primer contenido del curso.", textHtml: "Escribe aqui el primer contenido del curso." } }
      ]
    }]
  };

  const response = await fetch("/api/course", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(course)
  });

  if (!response.ok) return { ok: false };
  return { ok: true, course: { id, title: course.title, description: course.description, lessons: 1 } };
}

async function deleteCourse(id, title) {
  const confirmed = window.confirm(`Eliminar "${title}"?\n\nEsta accion no se puede deshacer.`);
  if (!confirmed) return;

  const response = await fetch(`/api/courses/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (response.status === 404) {
    window.alert("Reinicia el servidor local para eliminar cursos con la version nueva.");
    return;
  }
  const result = await response.json();
  if (!result.ok) {
    window.alert(result.error || "No se pudo eliminar el curso.");
    return;
  }
  loadCourses();
}

createButtons.forEach((button) => {
  button.addEventListener("click", createCourse);
});

grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-course]");
  if (!button) return;
  deleteCourse(button.dataset.deleteCourse, button.dataset.courseTitle);
});

search?.addEventListener("input", loadCourses);
loadCourses();
