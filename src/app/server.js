const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const projectRoot = path.resolve(__dirname, "../..");
const legacyPublicRoot = path.join(__dirname, "public");
const frontendRoot = path.join(__dirname, "frontend-dist");
const publicRoot = fs.existsSync(frontendRoot) ? frontendRoot : legacyPublicRoot;
const coursePath = path.join(projectRoot, "course", "course-data.json");
const coursesRoot = path.join(projectRoot, "course", "courses");
const runtimeRoot = path.join(projectRoot, "src", "runtime");
const exportScript = path.join(projectRoot, "scripts", "export-scorm.ps1");
const zipPath = path.join(projectRoot, "dist", "curso-demo-scorm.zip");
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".zip": "application/zip"
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value), "application/json; charset=utf-8");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Payload demasiado grande."));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function safeFile(root, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const target = path.normalize(path.join(root, decoded));
  return target.startsWith(root) ? target : null;
}

function serveStatic(res, filePath) {
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    send(res, 404, "No encontrado", "text/plain; charset=utf-8");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function serveAppShell(res) {
  const shell = path.join(publicRoot, "index.html");
  serveStatic(res, shell);
}

function validateCourse(course) {
  if (!course || typeof course !== "object") return "El curso no tiene un formato valido.";
  if (!course.title || typeof course.title !== "string") return "El curso necesita un titulo.";
  if (!Array.isArray(course.lessons) || course.lessons.length === 0) return "El curso necesita al menos una leccion.";
  return null;
}

function ensureCoursesRoot() {
  if (!fs.existsSync(coursesRoot)) fs.mkdirSync(coursesRoot, { recursive: true });
}

function slug(value) {
  return String(value || "curso")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "curso";
}

function courseFile(id) {
  const safeId = slug(id);
  return path.join(coursesRoot, `${safeId}.json`);
}

function readCourse(id = "curso-demo-scorm") {
  ensureCoursesRoot();
  const file = courseFile(id);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  return JSON.parse(fs.readFileSync(coursePath, "utf8"));
}

function writeCourse(course) {
  ensureCoursesRoot();
  const id = slug(course.id || course.title || "curso");
  course.id = id;
  fs.writeFileSync(courseFile(id), JSON.stringify(course, null, 2) + "\n", "utf8");
  if (id === "curso-demo-scorm") fs.writeFileSync(coursePath, JSON.stringify(course, null, 2) + "\n", "utf8");
  return course;
}

function courseSummary(course) {
  return {
    id: course.id || "curso-demo-scorm",
    title: course.title,
    description: course.description,
    lessons: Array.isArray(course.lessons) ? course.lessons.length : 0
  };
}

function listCourses() {
  ensureCoursesRoot();
  const summaries = fs.readdirSync(coursesRoot)
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(fs.readFileSync(path.join(coursesRoot, name), "utf8")))
    .map(courseSummary);

  if (!summaries.length) {
    const seeded = writeCourse(readCourse("curso-demo-scorm"));
    return [courseSummary(seeded)];
  }

  return summaries;
}

function createCourse() {
  const base = readCourse("curso-demo-scorm");
  const id = `${slug("nuevo-curso")}-${Date.now()}`;
  const course = {
    ...base,
    id,
    title: "Nuevo curso",
    description: "Describe el objetivo de este curso.",
    lessons: [
      {
        id: `lesson-${Date.now()}`,
        title: "Bienvenida",
        blocks: [
          {
            id: `b-${Date.now()}-1`,
            type: "heading",
            content: { text: "Bienvenida", textHtml: "Bienvenida" }
          },
          {
            id: `b-${Date.now()}-2`,
            type: "paragraph",
            content: { text: "Escribe aqui el primer contenido del curso.", textHtml: "Escribe aqui el primer contenido del curso." }
          }
        ]
      }
    ]
  };
  return writeCourse(course);
}

function exportScorm() {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", exportScript],
      { cwd: projectRoot, windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || stdout || error.message));
          return;
        }
        resolve(stdout);
      }
    );
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/courses") {
      sendJson(res, 200, { ok: true, courses: listCourses() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/courses") {
      const course = createCourse();
      sendJson(res, 200, { ok: true, course: courseSummary(course) });
      return;
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/courses/")) {
      const id = slug(url.pathname.replace("/api/courses/", ""));
      const courses = listCourses();
      if (courses.length <= 1) {
        sendJson(res, 400, { ok: false, error: "Debe quedar al menos un curso." });
        return;
      }
      const file = courseFile(id);
      if (fs.existsSync(file)) fs.unlinkSync(file);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/course") {
      send(res, 200, JSON.stringify(readCourse(url.searchParams.get("id") || "curso-demo-scorm")), "application/json; charset=utf-8");
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/course") {
      const body = await readBody(req);
      const course = JSON.parse(body);
      const validationError = validateCourse(course);

      if (validationError) {
        sendJson(res, 400, { ok: false, error: validationError });
        return;
      }

      writeCourse(course);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/export") {
      const id = url.searchParams.get("id");
      if (id) fs.writeFileSync(coursePath, JSON.stringify(readCourse(id), null, 2) + "\n", "utf8");
      await exportScorm();
      sendJson(res, 200, {
        ok: true,
        zipUrl: "/download/curso-demo-scorm.zip"
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/download/curso-demo-scorm.zip") {
      serveStatic(res, zipPath);
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/runtime-assets/")) {
      const file = safeFile(runtimeRoot, url.pathname.replace("/runtime-assets/", ""));
      serveStatic(res, file);
      return;
    }

    if (req.method === "GET") {
      const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
      if (fs.existsSync(frontendRoot) && (pathname === "/index.html" || pathname.endsWith(".html"))) {
        serveAppShell(res);
        return;
      }
      const file = safeFile(publicRoot, pathname);
      if (fs.existsSync(frontendRoot) && (!file || !fs.existsSync(file))) {
        serveAppShell(res);
        return;
      }
      serveStatic(res, file);
      return;
    }

    sendJson(res, 405, { ok: false, error: "Metodo no permitido." });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Authoring app running at http://localhost:${port}`);
});
