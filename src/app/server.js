const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const projectRoot = path.resolve(__dirname, "../..");
const publicRoot = path.join(__dirname, "public");
const coursePath = path.join(projectRoot, "course", "course-data.json");
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
      if (body.length > 2_000_000) reject(new Error("Payload demasiado grande."));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function safeFile(root, requestPath) {
  const target = path.normalize(path.join(root, decodeURIComponent(requestPath)));
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

function exportScorm() {
  return new Promise((resolve, reject) => {
    execFile("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", exportScript], { cwd: projectRoot, windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr || stdout || error.message));
      else resolve(stdout);
    });
  });
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/api/course") {
      send(res, 200, fs.readFileSync(coursePath, "utf8"));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/course") {
      const course = JSON.parse(await readBody(req));
      if (!course.title || !Array.isArray(course.lessons)) {
        sendJson(res, 400, { ok: false, error: "Curso invalido." });
        return;
      }
      fs.writeFileSync(coursePath, JSON.stringify(course, null, 2) + "\n", "utf8");
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/export") {
      await exportScorm();
      sendJson(res, 200, { ok: true, zipUrl: "/download/curso-demo-scorm.zip" });
      return;
    }
    if (req.method === "GET" && url.pathname === "/download/curso-demo-scorm.zip") {
      serveStatic(res, zipPath);
      return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/runtime-assets/")) {
      serveStatic(res, safeFile(runtimeRoot, url.pathname.replace("/runtime-assets/", "")));
      return;
    }
    if (req.method === "GET") {
      serveStatic(res, safeFile(publicRoot, url.pathname === "/" ? "/index.html" : url.pathname));
      return;
    }
    sendJson(res, 405, { ok: false, error: "Metodo no permitido." });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
}).listen(port, () => {
  console.log(`Authoring app running at http://localhost:${port}`);
});
