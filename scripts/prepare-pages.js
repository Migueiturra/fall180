const fs = require("fs");
const path = require("path");

const dist = path.resolve(__dirname, "../src/app/frontend-dist");
const index = path.join(dist, "index.html");

if (!fs.existsSync(index)) {
  throw new Error("No existe el build de Vite. Ejecuta npm run build primero.");
}

for (const file of ["courses.html", "preview.html", "404.html"]) {
  fs.copyFileSync(index, path.join(dist, file));
}
