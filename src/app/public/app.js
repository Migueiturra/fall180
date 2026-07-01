const state = {
  course: null,
  courseId: new URLSearchParams(window.location.search).get("course") || "curso-demo-scorm",
  selectedLessonIndex: 0,
  selectedBlockId: null,
  dirty: false
};

const els = {
  title: document.getElementById("course-title"),
  description: document.getElementById("course-description"),
  passingScore: document.getElementById("passing-score"),
  lessonList: document.getElementById("lesson-list"),
  blockList: document.getElementById("block-list"),
  blockForm: document.getElementById("block-form"),
  lessonTitleInput: document.getElementById("lesson-title-input"),
  currentLessonTitle: document.getElementById("current-lesson-title"),
  previewTitle: document.getElementById("preview-title"),
  preview: document.getElementById("preview"),
  saveStatus: document.getElementById("save-status"),
  toast: document.getElementById("toast"),
  saveButton: document.getElementById("save-button"),
  exportButton: document.getElementById("export-button")
};

const blockLabels = {
  heading: "Titulo",
  paragraph: "Parrafo",
  image_text: "Imagen + texto",
  embed: "Embed",
  custom_html: "HTML custom",
  divider: "Separador",
  statement: "Statement",
  continue_button: "Continuar",
  quiz_single_choice: "Opcion unica",
  quiz_multiple_response: "Respuesta multiple",
  quiz_fill_blank: "Completar espacio",
  quiz_matching: "Coincidencia"
};

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stripHtml(value) {
  var wrapper = document.createElement("div");
  wrapper.innerHTML = sanitizeRichHtml(value);
  return wrapper.textContent || "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeRichHtml(value) {
  var template = document.createElement("template");
  var allowedTags = ["B", "BR", "DIV", "EM", "I", "LI", "OL", "P", "SPAN", "STRONG", "U", "UL"];
  template.innerHTML = String(value || "");

  template.content.querySelectorAll("*").forEach((node) => {
    if (!allowedTags.includes(node.tagName)) {
      node.replaceWith(document.createTextNode(node.textContent || ""));
      return;
    }

    [...node.attributes].forEach((attribute) => {
      if (attribute.name !== "style") node.removeAttribute(attribute.name);
    });

    if (node.hasAttribute("style")) {
      var color = node.style.color;
      var backgroundColor = node.style.backgroundColor;
      node.removeAttribute("style");
      if (color) node.style.color = color;
      if (backgroundColor) node.style.backgroundColor = backgroundColor;
    }
  });

  return template.innerHTML;
}

function richValue(content, field) {
  if (content[`${field}Html`]) return sanitizeRichHtml(content[`${field}Html`]);
  return escapeHtml(content[field] || "");
}

function richEditor(label, field, html, minHeight = 96) {
  var colors = [
    ["#181833", "Tinta"],
    ["#3C3C59", "Noche"],
    ["#7A7A8C", "Grafito"],
    ["#8C8CBF", "Lavanda"],
    ["#8182F2", "Violeta"],
    ["#FFFFFF", "Blanco"],
    ["#F5F6FF", "Hielo"],
    ["#2F6FED", "Azul"],
    ["#119C8D", "Verde"],
    ["#D14D3F", "Rojo"],
    ["#F2A93B", "Amarillo"]
  ];

  return `
    <div class="rich-field">
      <span class="rich-label">${escapeHtml(label)}</span>
      <div class="rich-toolbar" data-rich-toolbar="${field}">
        <button type="button" data-rich-command="bold">B</button>
        <button type="button" data-rich-command="italic">I</button>
        <button type="button" data-rich-command="underline">U</button>
        <span class="toolbar-divider"></span>
        ${colors.map(([color, name]) => `<button class="swatch" type="button" title="${escapeHtml(name)}" aria-label="${escapeHtml(name)}" style="background:${color}" data-rich-color="${color}"></button>`).join("")}
      </div>
      <div class="rich-editor" style="min-height: ${minHeight}px" contenteditable="true" data-rich-field="${field}">${sanitizeRichHtml(html)}</div>
    </div>
  `;
}

function setDirty(value) {
  state.dirty = value;
  if (!els.saveStatus) return;
  els.saveStatus.textContent = value ? "Sin guardar" : "Guardado";
  els.saveStatus.style.color = value ? "#3C3C59" : "#181833";
  els.saveStatus.style.background = value ? "#EFEFFF" : "#F7F7FC";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2800);
}

function currentLesson() {
  return state.course.lessons[state.selectedLessonIndex];
}

function currentBlock() {
  const lesson = currentLesson();
  if (!state.selectedBlockId) return null;
  return lesson.blocks.find((block) => block.id === state.selectedBlockId) || null;
}

function resolveAsset(url) {
  if (!url) return "";
  if (url.startsWith("assets/")) return `/runtime-assets/${url.replace("assets/", "")}`;
  return url;
}

function embedUrl(url) {
  var value = String(url || "").trim();
  if (!value) return "";

  try {
    var parsed = new URL(value);
    var host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return `https://www.youtube.com/embed/${parsed.pathname.replace("/", "")}`;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      var videoId = parsed.searchParams.get("v");
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      if (parsed.pathname.startsWith("/embed/")) return value;
      if (parsed.pathname.startsWith("/shorts/")) return `https://www.youtube.com/embed/${parsed.pathname.split("/")[2]}`;
    }

    if (host === "vimeo.com") {
      var id = parsed.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }

    return value;
  } catch (error) {
    return value;
  }
}

function isDirectVideo(url) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(String(url || ""));
}

function mediaClass(content) {
  var size = content.size || "wide";
  var frame = content.hasFrame === false ? "no-frame" : "with-frame";
  return `media-block media-${size} media-${frame}`;
}

function aspectStyle(content) {
  var aspect = content.aspectRatio || "16 / 9";
  return `aspect-ratio: ${escapeHtml(aspect)}`;
}

function isQuestionBlock(block) {
  return ["quiz_single_choice", "quiz_multiple_response", "quiz_fill_blank", "quiz_matching"].includes(block.type);
}

function requiredBadge(block) {
  if (!isQuestionBlock(block)) return "";
  return `<span class="required-badge">${block.content.required === false ? "Opcional" : "Obligatoria"}</span>`;
}

function defaultBlock(type) {
  if (type === "heading") {
    return { id: uid("b"), type, content: { text: "Nuevo titulo", textHtml: "Nuevo titulo" } };
  }

  if (type === "paragraph") {
    return { id: uid("b"), type, content: { text: "Escribe aqui el contenido del parrafo.", textHtml: "Escribe aqui el contenido del parrafo." } };
  }

  if (type === "image_text") {
    return {
      id: uid("b"),
      type,
      content: {
        imageUrl: "assets/demo-learning.svg",
        imageAlt: "Imagen del curso",
        title: "Titulo del bloque",
        text: "Descripcion asociada a la imagen.",
        textHtml: "Descripcion asociada a la imagen."
      }
    };
  }

  if (type === "statement") {
    return {
      id: uid("b"),
      type,
      content: {
        text: "You're the master of your life, the captain of your ship. Steer it with intention.",
        textHtml: "You're the master of your life, the captain of your ship. Steer it with intention.",
        showDivider: true,
        width: "normal"
      }
    };
  }

  if (type === "quiz_single_choice") {
    return {
      id: uid("b"),
      type,
      content: {
        question: "Escribe la pregunta",
        options: ["Alternativa correcta", "Alternativa incorrecta", "Otra alternativa"],
        correctAnswer: 0,
        required: true,
        feedbackCorrect: "Correcto.",
        feedbackCorrectHtml: "Correcto.",
        feedbackIncorrect: "Revisa la respuesta e intenta nuevamente.",
        feedbackIncorrectHtml: "Revisa la respuesta e intenta nuevamente."
      }
    };
  }

  if (type === "quiz_multiple_response") {
    return {
      id: uid("b"),
      type,
      content: {
        question: "Selecciona todas las alternativas correctas",
        options: ["Respuesta correcta", "Otra respuesta correcta", "Distractor"],
        correctAnswers: [0, 1],
        required: true,
        feedbackCorrect: "Correcto.",
        feedbackCorrectHtml: "Correcto.",
        feedbackIncorrect: "Revisa las alternativas e intenta nuevamente.",
        feedbackIncorrectHtml: "Revisa las alternativas e intenta nuevamente."
      }
    };
  }

  if (type === "quiz_fill_blank") {
    return {
      id: uid("b"),
      type,
      content: {
        question: "Completa la frase",
        prompt: "La pieza que reconoce el LMS es el archivo ____.",
        answers: ["imsmanifest.xml"],
        caseSensitive: false,
        required: true,
        feedbackCorrect: "Correcto.",
        feedbackCorrectHtml: "Correcto.",
        feedbackIncorrect: "Revisa la respuesta e intenta nuevamente.",
        feedbackIncorrectHtml: "Revisa la respuesta e intenta nuevamente."
      }
    };
  }

  if (type === "quiz_matching") {
    return {
      id: uid("b"),
      type,
      content: {
        question: "Relaciona cada concepto con su descripcion",
        pairs: [
          { prompt: "SCORM", match: "Paquete que conversa con el LMS" },
          { prompt: "Manifest", match: "Archivo que describe el contenido" }
        ],
        required: true,
        feedbackCorrect: "Correcto.",
        feedbackCorrectHtml: "Correcto.",
        feedbackIncorrect: "Revisa las coincidencias e intenta nuevamente.",
        feedbackIncorrectHtml: "Revisa las coincidencias e intenta nuevamente."
      }
    };
  }

  if (type === "embed") {
    return {
      id: uid("b"),
      type,
      content: {
        title: "Video o recurso embebido",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        caption: "",
        size: "wide",
        aspectRatio: "16 / 9",
        hasFrame: true
      }
    };
  }

  if (type === "custom_html") {
    return {
      id: uid("b"),
      type,
      content: {
        title: "Contenido HTML custom",
        html: "<div style=\"font-family: Arial; padding: 24px; text-align: center;\">\\n  <h2>Bloque HTML personalizado</h2>\\n  <p>Escribe aqui tu codigo HTML.</p>\\n</div>",
        size: "wide",
        aspectRatio: "16 / 9",
        hasFrame: true
      }
    };
  }

  if (type === "continue_button") {
    return {
      id: uid("b"),
      type,
      content: {
        label: "Continuar",
        hint: "El contenido que viene despues se mostrara cuando el estudiante haga clic."
      }
    };
  }

  return { id: uid("b"), type: "divider", content: {} };
}

function updateCourseFromFields() {
  state.course.title = els.title.value.trim() || "Curso sin titulo";
  state.course.description = els.description.value.trim();
  state.course.scorm = state.course.scorm || {};
  state.course.scorm.passingScore = Number(els.passingScore.value || 80);
  setDirty(true);
  renderPreview();
}

function renderCourseFields() {
  els.title.value = state.course.title || "";
  els.description.value = state.course.description || "";
  els.passingScore.value = state.course.scorm?.passingScore || 80;
}

function renderLessons() {
  els.lessonList.innerHTML = state.course.lessons.map((lesson, index) => {
    const active = index === state.selectedLessonIndex ? " active" : "";
    return `
      <article class="lesson-item${active}">
        <button class="lesson-title" type="button" data-select-lesson="${index}">
          ${escapeHtml(lesson.title || `Leccion ${index + 1}`)}
        </button>
        <div class="item-actions lesson-actions">
          <button class="icon-button" type="button" title="Subir" aria-label="Subir leccion" data-move-lesson="${index}" data-direction="-1">&uarr;</button>
          <button class="icon-button" type="button" title="Bajar" aria-label="Bajar leccion" data-move-lesson="${index}" data-direction="1">&darr;</button>
          <button class="icon-button danger" type="button" title="Borrar" aria-label="Borrar leccion" data-delete-lesson="${index}">&#128465;</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderEditorBlockPreview(block) {
  return `
    <div class="editor-block-meta">
      <span>${escapeHtml(blockLabels[block.type] || block.type)}</span>
      ${requiredBadge(block)}
    </div>
    <div class="editor-block-preview">
      ${renderPreviewBlock(block)}
    </div>
  `;
}

function renderActiveBlockShell(block) {
  return `
    <div class="editor-block-meta">
      <span>Editando ${escapeHtml(blockLabels[block.type] || block.type)}</span>
      ${requiredBadge(block)}
    </div>
  `;
}

function renderBlocks() {
  const lesson = currentLesson();
  els.currentLessonTitle.textContent = lesson.title || "Leccion";
  els.lessonTitleInput.value = lesson.title || "";

  els.blockList.innerHTML = lesson.blocks.map((block, index) => {
    const isActive = block.id === state.selectedBlockId;
    const active = isActive ? " active" : "";
    return `
      <article class="block-item${active}">
        <button class="block-edit-rail" type="button" data-select-block="${escapeHtml(block.id)}">Editar</button>
        <div class="block-main" data-select-block="${escapeHtml(block.id)}">
          ${isActive ? renderActiveBlockShell(block) : renderEditorBlockPreview(block)}
        </div>
        <div class="item-actions block-actions">
          <button type="button" data-move-block="${index}" data-direction="-1">Arriba</button>
          <button type="button" data-move-block="${index}" data-direction="1">Abajo</button>
          <button class="danger" type="button" data-delete-block="${escapeHtml(block.id)}">Borrar</button>
        </div>
      </article>
    `;
  }).join("");

  renderBlockForm();
  const activeBlock = els.blockList.querySelector(".block-item.active");
  if (activeBlock && els.blockForm.innerHTML.trim()) {
    activeBlock.insertAdjacentHTML("beforeend", `
      <div class="inline-editor">
        <div class="inline-editor-actions">
          <button class="small primary" type="button" data-save-block>Guardar bloque</button>
        </div>
        ${els.blockForm.innerHTML}
      </div>
    `);
    els.blockForm.innerHTML = "";
  }
}

function renderBlockForm() {
  const block = currentBlock();

  if (!block) {
    els.blockForm.innerHTML = "";
    return;
  }

  state.selectedBlockId = block.id;

  if (block.type === "heading" || block.type === "paragraph") {
    const isParagraph = block.type === "paragraph";
    els.blockForm.innerHTML = `
      ${richEditor("Texto", "text", block.content.textHtml || escapeHtml(block.content.text), isParagraph ? 150 : 72)}
    `;
    return;
  }

  if (block.type === "image_text") {
    els.blockForm.innerHTML = `
      <div class="form-grid">
        <label class="full">
          URL de imagen
          <input type="text" data-field="imageUrl" value="${escapeHtml(block.content.imageUrl)}">
        </label>
        <label class="full">
          Texto alternativo
          <input type="text" data-field="imageAlt" value="${escapeHtml(block.content.imageAlt)}">
        </label>
        <label class="full">
          Titulo
          <input type="text" data-field="title" value="${escapeHtml(block.content.title)}">
        </label>
        <div class="full">
          ${richEditor("Texto", "text", block.content.textHtml || escapeHtml(block.content.text), 130)}
        </div>
      </div>
    `;
    return;
  }

  if (block.type === "statement") {
    els.blockForm.innerHTML = `
      <div class="form-grid">
        <label>
          Ancho
          <select data-field="width">
            <option value="narrow"${block.content.width === "narrow" ? " selected" : ""}>Estrecho</option>
            <option value="normal"${(block.content.width || "normal") === "normal" ? " selected" : ""}>Normal</option>
            <option value="wide"${block.content.width === "wide" ? " selected" : ""}>Ancho</option>
          </select>
        </label>
        <label>
          Linea superior
          <select data-boolean-field="showDivider">
            <option value="true"${block.content.showDivider !== false ? " selected" : ""}>Mostrar</option>
            <option value="false"${block.content.showDivider === false ? " selected" : ""}>Ocultar</option>
          </select>
        </label>
        <div class="full">
          ${richEditor("Statement", "text", block.content.textHtml || escapeHtml(block.content.text), 150)}
        </div>
      </div>
    `;
    return;
  }

  if (block.type === "embed") {
    els.blockForm.innerHTML = `
      <div class="form-grid">
        <label class="full">
          Titulo interno
          <input type="text" data-field="title" value="${escapeHtml(block.content.title)}">
        </label>
        <label class="full">
          URL del recurso
          <input type="text" data-field="url" value="${escapeHtml(block.content.url)}" placeholder="YouTube, Vimeo, MP4 o URL embebible">
        </label>
        <label>
          Tamano
          <select data-field="size">
            <option value="narrow"${block.content.size === "narrow" ? " selected" : ""}>Estrecho</option>
            <option value="normal"${block.content.size === "normal" ? " selected" : ""}>Normal</option>
            <option value="wide"${(block.content.size || "wide") === "wide" ? " selected" : ""}>Ancho</option>
            <option value="full"${block.content.size === "full" ? " selected" : ""}>Completo</option>
          </select>
        </label>
        <label>
          Proporcion
          <select data-field="aspectRatio">
            <option value="16 / 9"${(block.content.aspectRatio || "16 / 9") === "16 / 9" ? " selected" : ""}>16:9</option>
            <option value="4 / 3"${block.content.aspectRatio === "4 / 3" ? " selected" : ""}>4:3</option>
            <option value="1 / 1"${block.content.aspectRatio === "1 / 1" ? " selected" : ""}>1:1</option>
            <option value="9 / 16"${block.content.aspectRatio === "9 / 16" ? " selected" : ""}>Vertical</option>
          </select>
        </label>
        <label>
          Marco
          <select data-boolean-field="hasFrame">
            <option value="true"${block.content.hasFrame !== false ? " selected" : ""}>Con marco</option>
            <option value="false"${block.content.hasFrame === false ? " selected" : ""}>Sin marco</option>
          </select>
        </label>
        <label>
          Bajada opcional
          <input type="text" data-field="caption" value="${escapeHtml(block.content.caption)}">
        </label>
      </div>
    `;
    return;
  }

  if (block.type === "custom_html") {
    els.blockForm.innerHTML = `
      <div class="form-grid">
        <label class="full">
          Titulo interno
          <input type="text" data-field="title" value="${escapeHtml(block.content.title)}">
        </label>
        <label>
          Tamano
          <select data-field="size">
            <option value="narrow"${block.content.size === "narrow" ? " selected" : ""}>Estrecho</option>
            <option value="normal"${block.content.size === "normal" ? " selected" : ""}>Normal</option>
            <option value="wide"${(block.content.size || "wide") === "wide" ? " selected" : ""}>Ancho</option>
            <option value="full"${block.content.size === "full" ? " selected" : ""}>Completo</option>
          </select>
        </label>
        <label>
          Proporcion
          <select data-field="aspectRatio">
            <option value="16 / 9"${(block.content.aspectRatio || "16 / 9") === "16 / 9" ? " selected" : ""}>16:9</option>
            <option value="4 / 3"${block.content.aspectRatio === "4 / 3" ? " selected" : ""}>4:3</option>
            <option value="1 / 1"${block.content.aspectRatio === "1 / 1" ? " selected" : ""}>1:1</option>
            <option value="9 / 16"${block.content.aspectRatio === "9 / 16" ? " selected" : ""}>Vertical</option>
          </select>
        </label>
        <label>
          Marco
          <select data-boolean-field="hasFrame">
            <option value="true"${block.content.hasFrame !== false ? " selected" : ""}>Con marco</option>
            <option value="false"${block.content.hasFrame === false ? " selected" : ""}>Sin marco</option>
          </select>
        </label>
        <label class="full">
          Codigo HTML
          <textarea class="code-editor" rows="12" data-field="html" spellcheck="false">${escapeHtml(block.content.html)}</textarea>
        </label>
      </div>
    `;
    return;
  }

  if (block.type === "continue_button") {
    els.blockForm.innerHTML = `
      <div class="form-grid">
        <label>
          Texto del boton
          <input type="text" data-field="label" value="${escapeHtml(block.content.label || "Continuar")}">
        </label>
        <label class="full">
          Nota interna
          <input type="text" data-field="hint" value="${escapeHtml(block.content.hint || "")}">
        </label>
      </div>
    `;
    return;
  }

  if (block.type === "quiz_single_choice") {
    const options = block.content.options.map((option, index) => `
      <div class="option-row">
        <label>
          Alternativa ${index + 1}
          <input type="text" data-option="${index}" value="${escapeHtml(option)}">
        </label>
        <label>
          Correcta
          <select data-correct="${index}">
            <option value="no"${block.content.correctAnswer === index ? "" : " selected"}>No</option>
            <option value="yes"${block.content.correctAnswer === index ? " selected" : ""}>Si</option>
          </select>
        </label>
        <button class="danger" type="button" data-remove-option="${index}">Borrar</button>
      </div>
    `).join("");

    els.blockForm.innerHTML = `
      <div class="form-grid">
        <label>
          Obligatoria para avanzar
          <select data-boolean-field="required">
            <option value="true"${block.content.required !== false ? " selected" : ""}>Si</option>
            <option value="false"${block.content.required === false ? " selected" : ""}>No</option>
          </select>
        </label>
      </div>
      ${richEditor("Pregunta", "question", block.content.questionHtml || escapeHtml(block.content.question), 92)}
      ${options}
      <button class="small" type="button" data-add-option>Agregar alternativa</button>
      <div class="form-grid">
        ${richEditor("Feedback correcto", "feedbackCorrect", block.content.feedbackCorrectHtml || escapeHtml(block.content.feedbackCorrect), 92)}
        ${richEditor("Feedback incorrecto", "feedbackIncorrect", block.content.feedbackIncorrectHtml || escapeHtml(block.content.feedbackIncorrect), 92)}
      </div>
    `;
    return;
  }

  if (block.type === "quiz_multiple_response") {
    const correctAnswers = block.content.correctAnswers || [];
    const options = block.content.options.map((option, index) => `
      <div class="option-row">
        <label>
          Alternativa ${index + 1}
          <input type="text" data-option="${index}" value="${escapeHtml(option)}">
        </label>
        <label>
          Correcta
          <select data-multi-correct="${index}">
            <option value="no"${correctAnswers.includes(index) ? "" : " selected"}>No</option>
            <option value="yes"${correctAnswers.includes(index) ? " selected" : ""}>Si</option>
          </select>
        </label>
        <button class="danger" type="button" data-remove-option="${index}">Borrar</button>
      </div>
    `).join("");

    els.blockForm.innerHTML = `
      <div class="form-grid">
        <label>
          Obligatoria para avanzar
          <select data-boolean-field="required">
            <option value="true"${block.content.required !== false ? " selected" : ""}>Si</option>
            <option value="false"${block.content.required === false ? " selected" : ""}>No</option>
          </select>
        </label>
      </div>
      ${richEditor("Pregunta", "question", block.content.questionHtml || escapeHtml(block.content.question), 92)}
      ${options}
      <button class="small" type="button" data-add-option>Agregar alternativa</button>
      <div class="form-grid">
        ${richEditor("Feedback correcto", "feedbackCorrect", block.content.feedbackCorrectHtml || escapeHtml(block.content.feedbackCorrect), 92)}
        ${richEditor("Feedback incorrecto", "feedbackIncorrect", block.content.feedbackIncorrectHtml || escapeHtml(block.content.feedbackIncorrect), 92)}
      </div>
    `;
    return;
  }

  if (block.type === "quiz_fill_blank") {
    els.blockForm.innerHTML = `
      <div class="form-grid">
        <label>
          Obligatoria para avanzar
          <select data-boolean-field="required">
            <option value="true"${block.content.required !== false ? " selected" : ""}>Si</option>
            <option value="false"${block.content.required === false ? " selected" : ""}>No</option>
          </select>
        </label>
        <label>
          Mayusculas importan
          <select data-boolean-field="caseSensitive">
            <option value="false"${block.content.caseSensitive ? "" : " selected"}>No</option>
            <option value="true"${block.content.caseSensitive ? " selected" : ""}>Si</option>
          </select>
        </label>
        <div class="full">
          ${richEditor("Pregunta", "question", block.content.questionHtml || escapeHtml(block.content.question), 92)}
        </div>
        <label class="full">
          Frase con espacio en blanco
          <input type="text" data-field="prompt" value="${escapeHtml(block.content.prompt)}">
        </label>
        <label class="full">
          Respuestas correctas, una por linea
          <textarea data-answer-list rows="4">${escapeHtml((block.content.answers || []).join("\n"))}</textarea>
        </label>
        ${richEditor("Feedback correcto", "feedbackCorrect", block.content.feedbackCorrectHtml || escapeHtml(block.content.feedbackCorrect), 92)}
        ${richEditor("Feedback incorrecto", "feedbackIncorrect", block.content.feedbackIncorrectHtml || escapeHtml(block.content.feedbackIncorrect), 92)}
      </div>
    `;
    return;
  }

  if (block.type === "quiz_matching") {
    const pairs = (block.content.pairs || []).map((pair, index) => `
      <div class="pair-row">
        <label>
          Concepto ${index + 1}
          <input type="text" data-pair-prompt="${index}" value="${escapeHtml(pair.prompt)}">
        </label>
        <label>
          Coincidencia
          <input type="text" data-pair-match="${index}" value="${escapeHtml(pair.match)}">
        </label>
        <button class="danger" type="button" data-remove-pair="${index}">Borrar</button>
      </div>
    `).join("");

    els.blockForm.innerHTML = `
      <div class="form-grid">
        <label>
          Obligatoria para avanzar
          <select data-boolean-field="required">
            <option value="true"${block.content.required !== false ? " selected" : ""}>Si</option>
            <option value="false"${block.content.required === false ? " selected" : ""}>No</option>
          </select>
        </label>
      </div>
      ${richEditor("Pregunta", "question", block.content.questionHtml || escapeHtml(block.content.question), 92)}
      ${pairs}
      <button class="small" type="button" data-add-pair>Agregar par</button>
      <div class="form-grid">
        ${richEditor("Feedback correcto", "feedbackCorrect", block.content.feedbackCorrectHtml || escapeHtml(block.content.feedbackCorrect), 92)}
        ${richEditor("Feedback incorrecto", "feedbackIncorrect", block.content.feedbackIncorrectHtml || escapeHtml(block.content.feedbackIncorrect), 92)}
      </div>
    `;
    return;
  }

  els.blockForm.innerHTML = "<p>Este bloque no necesita configuracion.</p>";
}

function renderPreview() {
  if (!els.preview || !els.previewTitle) return;
  els.previewTitle.textContent = state.course.title || "Curso";
  els.preview.innerHTML = `
    <h3 class="preview-course-title">${escapeHtml(state.course.title)}</h3>
    <p class="preview-description">${escapeHtml(state.course.description)}</p>
    ${state.course.lessons.map((lesson) => `
      <section class="preview-lesson">
        <h3>${escapeHtml(lesson.title)}</h3>
        ${lesson.blocks.map(renderPreviewBlock).join("")}
      </section>
    `).join("")}
  `;
}

function renderPreviewBlock(block) {
  if (block.type === "heading") {
    return `<article class="preview-block"><h4>${richValue(block.content, "text")}</h4></article>`;
  }

  if (block.type === "paragraph") {
    return `<article class="preview-block rich-output">${richValue(block.content, "text")}</article>`;
  }

  if (block.type === "image_text") {
    return `
      <article class="preview-block preview-image-text">
        <img src="${escapeHtml(resolveAsset(block.content.imageUrl))}" alt="${escapeHtml(block.content.imageAlt)}">
        <div>
          <strong>${escapeHtml(block.content.title)}</strong>
          <div class="rich-output">${richValue(block.content, "text")}</div>
        </div>
      </article>
    `;
  }

  if (block.type === "statement") {
    return `
      <article class="preview-block statement-block statement-${escapeHtml(block.content.width || "normal")}">
        ${block.content.showDivider !== false ? `<span class="statement-rule"></span>` : ""}
        <div class="rich-output">${richValue(block.content, "text")}</div>
      </article>
    `;
  }

  if (block.type === "divider") {
    return `<hr class="preview-divider">`;
  }

  if (block.type === "embed") {
    const url = embedUrl(block.content.url);
    const media = isDirectVideo(url)
      ? `<video src="${escapeHtml(url)}" controls></video>`
      : `<iframe src="${escapeHtml(url)}" title="${escapeHtml(block.content.title || "Recurso embebido")}" allowfullscreen loading="lazy"></iframe>`;

    return `
      <article class="preview-block ${mediaClass(block.content)}">
        ${block.content.title ? `<strong class="media-title">${escapeHtml(block.content.title)}</strong>` : ""}
        <div class="media-shell" style="${aspectStyle(block.content)}">${media}</div>
        ${block.content.caption ? `<p class="media-caption">${escapeHtml(block.content.caption)}</p>` : ""}
      </article>
    `;
  }

  if (block.type === "custom_html") {
    return `
      <article class="preview-block ${mediaClass(block.content)}">
        ${block.content.title ? `<strong class="media-title">${escapeHtml(block.content.title)}</strong>` : ""}
        <iframe class="custom-html-frame" title="${escapeHtml(block.content.title || "HTML custom")}" sandbox="allow-scripts allow-forms allow-popups" srcdoc="${escapeHtml(block.content.html || "")}" style="${aspectStyle(block.content)}"></iframe>
      </article>
    `;
  }

  if (block.type === "quiz_single_choice") {
    return `
      <article class="preview-block preview-quiz">
        <strong>${richValue(block.content, "question")}</strong>
        ${requiredBadge(block)}
        <ul class="quiz-preview-list">
          ${block.content.options.map((option, index) => `
            <li>${escapeHtml(option)}${block.content.correctAnswer === index ? " - correcta" : ""}</li>
          `).join("")}
        </ul>
      </article>
    `;
  }

  if (block.type === "quiz_multiple_response") {
    const correctAnswers = block.content.correctAnswers || [];
    return `
      <article class="preview-block preview-quiz">
        <strong>${richValue(block.content, "question")}</strong>
        ${requiredBadge(block)}
        <ul class="quiz-preview-list">
          ${block.content.options.map((option, index) => `
            <li>${escapeHtml(option)}${correctAnswers.includes(index) ? " - correcta" : ""}</li>
          `).join("")}
        </ul>
      </article>
    `;
  }

  if (block.type === "quiz_fill_blank") {
    return `
      <article class="preview-block preview-quiz">
        <strong>${richValue(block.content, "question")}</strong>
        ${requiredBadge(block)}
        <p>${escapeHtml(block.content.prompt || "")}</p>
        <input type="text" value="" placeholder="Respuesta del estudiante" disabled>
      </article>
    `;
  }

  if (block.type === "quiz_matching") {
    return `
      <article class="preview-block preview-quiz">
        <strong>${richValue(block.content, "question")}</strong>
        ${requiredBadge(block)}
        <div class="matching-preview">
          ${(block.content.pairs || []).map((pair) => `
            <span>${escapeHtml(pair.prompt)}</span>
            <span>${escapeHtml(pair.match)}</span>
          `).join("")}
        </div>
      </article>
    `;
  }

  if (block.type === "continue_button") {
    return `
      <article class="preview-block preview-continue">
        <button type="button">${escapeHtml(block.content.label || "Continuar")}</button>
      </article>
    `;
  }

  return "";
}

function renderAll() {
  renderCourseFields();
  renderLessons();
  renderBlocks();
  renderPreview();
}

async function loadCourse() {
  const response = await fetch(`/api/course?id=${encodeURIComponent(state.courseId)}`);
  state.course = await response.json();
  state.courseId = state.course.id || state.courseId;
  state.selectedLessonIndex = 0;
  state.selectedBlockId = null;
  renderAll();
  setDirty(false);
}

async function saveCourse() {
  const response = await fetch(`/api/course?id=${encodeURIComponent(state.courseId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state.course)
  });
  const result = await response.json();

  if (!result.ok) {
    showToast(result.error || "No se pudo guardar.");
    return false;
  }

  setDirty(false);
  showToast("Curso guardado.");
  return true;
}

async function exportCourse() {
  els.exportButton.disabled = true;
  els.exportButton.textContent = "Exportando...";

  if (state.dirty) {
    const saved = await saveCourse();
    if (!saved) {
      els.exportButton.disabled = false;
      els.exportButton.textContent = "Exportar SCORM";
      return;
    }
  }

  const response = await fetch(`/api/export?id=${encodeURIComponent(state.courseId)}`, { method: "POST" });
  const result = await response.json();

  els.exportButton.disabled = false;
  els.exportButton.textContent = "Exportar SCORM";

  if (!result.ok) {
    showToast(result.error || "No se pudo exportar.");
    return;
  }

  showToast("SCORM exportado.");
  window.location.href = result.zipUrl;
}

function moveItem(list, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(target, 0, item);
}

function bindEditorSurface(surface) {
  surface.addEventListener("mousedown", (event) => {
    if (event.target.closest("[data-rich-command], [data-rich-color]")) {
      event.preventDefault();
    }
  });

  surface.addEventListener("input", (event) => {
    const block = currentBlock();
    if (!block) return;

    if (event.target.dataset.field) {
      block.content[event.target.dataset.field] = event.target.value;
    }

    if (event.target.dataset.booleanField) {
      block.content[event.target.dataset.booleanField] = event.target.value === "true";
    }

    if (event.target.dataset.richField) {
      var field = event.target.dataset.richField;
      block.content[`${field}Html`] = sanitizeRichHtml(event.target.innerHTML);
      block.content[field] = stripHtml(event.target.innerHTML).trim();
    }

    if (event.target.dataset.option) {
      block.content.options[Number(event.target.dataset.option)] = event.target.value;
    }

    if (event.target.dataset.correct && event.target.value === "yes") {
      block.content.correctAnswer = Number(event.target.dataset.correct);
      renderBlocks();
    }

    if (event.target.dataset.multiCorrect) {
      const index = Number(event.target.dataset.multiCorrect);
      block.content.correctAnswers = block.content.correctAnswers || [];
      block.content.correctAnswers = block.content.correctAnswers.filter((item) => item !== index);
      if (event.target.value === "yes") block.content.correctAnswers.push(index);
      block.content.correctAnswers.sort((a, b) => a - b);
      renderBlocks();
    }

    if (event.target.dataset.answerList !== undefined) {
      block.content.answers = event.target.value.split("\n").map((item) => item.trim()).filter(Boolean);
    }

    if (event.target.dataset.pairPrompt !== undefined) {
      block.content.pairs[Number(event.target.dataset.pairPrompt)].prompt = event.target.value;
    }

    if (event.target.dataset.pairMatch !== undefined) {
      block.content.pairs[Number(event.target.dataset.pairMatch)].match = event.target.value;
    }

    setDirty(true);
    renderPreview();
  });

  surface.addEventListener("change", (event) => {
    if (!event.target.matches("select")) return;
    event.target.dispatchEvent(new Event("input", { bubbles: true }));
  });

  surface.addEventListener("click", (event) => {
    const richButton = event.target.closest("[data-rich-command], [data-rich-color]");
    if (richButton) {
      event.preventDefault();

      if (richButton.dataset.richCommand) {
        document.execCommand(richButton.dataset.richCommand, false, null);
      }

      if (richButton.dataset.richColor) {
        document.execCommand("foreColor", false, richButton.dataset.richColor);
      }

      const editor = surface.querySelector(".rich-editor:focus");
      if (editor) {
        editor.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }

    const saveBlock = event.target.closest("[data-save-block]");
    if (saveBlock) {
      saveCourse().then((saved) => {
        if (!saved) return;
        state.selectedBlockId = null;
        renderAll();
      });
      return;
    }

    const block = currentBlock();
    if (!block || !isQuestionBlock(block)) return;

    if (event.target.closest("[data-add-option]")) {
      block.content.options.push("Nueva alternativa");
      setDirty(true);
      renderAll();
    }

    const remove = event.target.closest("[data-remove-option]");
    if (remove && block.content.options.length > 2) {
      const index = Number(remove.dataset.removeOption);
      block.content.options.splice(index, 1);
      block.content.correctAnswer = Math.min(block.content.correctAnswer, block.content.options.length - 1);
      if (block.content.correctAnswers) {
        block.content.correctAnswers = block.content.correctAnswers
          .filter((item) => item !== index)
          .map((item) => item > index ? item - 1 : item);
      }
      setDirty(true);
      renderAll();
    }

    if (event.target.closest("[data-add-pair]")) {
      block.content.pairs.push({ prompt: "Nuevo concepto", match: "Nueva coincidencia" });
      setDirty(true);
      renderAll();
    }

    const removePair = event.target.closest("[data-remove-pair]");
    if (removePair && block.content.pairs.length > 2) {
      block.content.pairs.splice(Number(removePair.dataset.removePair), 1);
      setDirty(true);
      renderAll();
    }
  });
}

function bindEvents() {
  els.title.addEventListener("input", updateCourseFromFields);
  els.description.addEventListener("input", updateCourseFromFields);
  els.passingScore.addEventListener("input", updateCourseFromFields);
  els.lessonTitleInput.addEventListener("input", () => {
    currentLesson().title = els.lessonTitleInput.value.trim() || "Leccion sin titulo";
    els.currentLessonTitle.textContent = currentLesson().title;
    setDirty(true);
    renderLessons();
    renderPreview();
  });
  els.saveButton.addEventListener("click", saveCourse);
  els.exportButton.addEventListener("click", exportCourse);

  document.getElementById("add-lesson").addEventListener("click", () => {
    const lesson = {
      id: uid("lesson"),
      title: `Nueva leccion ${state.course.lessons.length + 1}`,
      blocks: [defaultBlock("heading"), defaultBlock("paragraph")]
    };
    state.course.lessons.push(lesson);
    state.selectedLessonIndex = state.course.lessons.length - 1;
    state.selectedBlockId = null;
    setDirty(true);
    renderAll();
  });

  document.querySelector(".toolbar").addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-block]");
    if (!button) return;
    const block = defaultBlock(button.dataset.addBlock);
    currentLesson().blocks.push(block);
    state.selectedBlockId = block.id;
    setDirty(true);
    renderAll();
  });

  els.lessonList.addEventListener("click", (event) => {
    const select = event.target.closest("[data-select-lesson]");
    const move = event.target.closest("[data-move-lesson]");
    const remove = event.target.closest("[data-delete-lesson]");

    if (select) {
      state.selectedLessonIndex = Number(select.dataset.selectLesson);
      state.selectedBlockId = null;
      renderAll();
    }

    if (move) {
      const index = Number(move.dataset.moveLesson);
      moveItem(state.course.lessons, index, Number(move.dataset.direction));
      state.selectedLessonIndex = Math.max(0, Math.min(state.course.lessons.length - 1, index + Number(move.dataset.direction)));
      setDirty(true);
      renderAll();
    }

    if (remove && state.course.lessons.length > 1) {
      state.course.lessons.splice(Number(remove.dataset.deleteLesson), 1);
      state.selectedLessonIndex = Math.max(0, state.selectedLessonIndex - 1);
      state.selectedBlockId = null;
      setDirty(true);
      renderAll();
    }
  });

  els.blockList.addEventListener("click", (event) => {
    const select = event.target.closest("[data-select-block]");
    const move = event.target.closest("[data-move-block]");
    const remove = event.target.closest("[data-delete-block]");
    const blocks = currentLesson().blocks;

    if (select) {
      state.selectedBlockId = select.dataset.selectBlock;
      renderBlocks();
    }

    if (move) {
      const index = Number(move.dataset.moveBlock);
      moveItem(blocks, index, Number(move.dataset.direction));
      setDirty(true);
      renderAll();
    }

    if (remove) {
      const index = blocks.findIndex((block) => block.id === remove.dataset.deleteBlock);
      blocks.splice(index, 1);
      state.selectedBlockId = blocks[Math.max(0, index - 1)]?.id || null;
      setDirty(true);
      renderAll();
    }
  });

  els.blockList.addEventListener("dblclick", (event) => {
    const card = event.target.closest(".block-item");
    if (!card) return;
    const select = card.querySelector("[data-select-block]");
    if (!select) return;
    state.selectedBlockId = select.dataset.selectBlock;
    renderBlocks();
  });

  bindEditorSurface(els.blockList);

  els.blockForm.addEventListener("mousedown", (event) => {
    if (event.target.closest("[data-rich-command], [data-rich-color]")) {
      event.preventDefault();
    }
  });

  els.blockForm.addEventListener("input", (event) => {
    const block = currentBlock();
    if (!block) return;

    if (event.target.dataset.field) {
      block.content[event.target.dataset.field] = event.target.value;
    }

    if (event.target.dataset.booleanField) {
      block.content[event.target.dataset.booleanField] = event.target.value === "true";
    }

    if (event.target.dataset.richField) {
      var field = event.target.dataset.richField;
      block.content[`${field}Html`] = sanitizeRichHtml(event.target.innerHTML);
      block.content[field] = stripHtml(event.target.innerHTML).trim();
    }

    if (event.target.dataset.option) {
      block.content.options[Number(event.target.dataset.option)] = event.target.value;
    }

    if (event.target.dataset.correct && event.target.value === "yes") {
      block.content.correctAnswer = Number(event.target.dataset.correct);
      renderBlockForm();
    }

    if (event.target.dataset.multiCorrect) {
      const index = Number(event.target.dataset.multiCorrect);
      block.content.correctAnswers = block.content.correctAnswers || [];
      block.content.correctAnswers = block.content.correctAnswers.filter((item) => item !== index);
      if (event.target.value === "yes") block.content.correctAnswers.push(index);
      block.content.correctAnswers.sort((a, b) => a - b);
      renderBlockForm();
    }

    if (event.target.dataset.answerList !== undefined) {
      block.content.answers = event.target.value.split("\n").map((item) => item.trim()).filter(Boolean);
    }

    if (event.target.dataset.pairPrompt !== undefined) {
      block.content.pairs[Number(event.target.dataset.pairPrompt)].prompt = event.target.value;
    }

    if (event.target.dataset.pairMatch !== undefined) {
      block.content.pairs[Number(event.target.dataset.pairMatch)].match = event.target.value;
    }

    setDirty(true);
    renderPreview();
  });

  els.blockForm.addEventListener("change", (event) => {
    if (!event.target.matches("select")) return;
    event.target.dispatchEvent(new Event("input", { bubbles: true }));
  });

  els.blockForm.addEventListener("click", (event) => {
    const richButton = event.target.closest("[data-rich-command], [data-rich-color]");
    if (richButton) {
      event.preventDefault();

      if (richButton.dataset.richCommand) {
        document.execCommand(richButton.dataset.richCommand, false, null);
      }

      if (richButton.dataset.richColor) {
        document.execCommand("foreColor", false, richButton.dataset.richColor);
      }

      const editor = els.blockForm.querySelector(".rich-editor:focus");
      if (editor) {
        editor.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }

    const block = currentBlock();
    if (!block || !isQuestionBlock(block)) return;

    if (event.target.closest("[data-add-option]")) {
      block.content.options.push("Nueva alternativa");
      setDirty(true);
      renderAll();
    }

    const remove = event.target.closest("[data-remove-option]");
    if (remove && block.content.options.length > 2) {
      const index = Number(remove.dataset.removeOption);
      block.content.options.splice(index, 1);
      block.content.correctAnswer = Math.min(block.content.correctAnswer, block.content.options.length - 1);
      if (block.content.correctAnswers) {
        block.content.correctAnswers = block.content.correctAnswers
          .filter((item) => item !== index)
          .map((item) => item > index ? item - 1 : item);
      }
      setDirty(true);
      renderAll();
    }

    if (event.target.closest("[data-add-pair]")) {
      block.content.pairs.push({ prompt: "Nuevo concepto", match: "Nueva coincidencia" });
      setDirty(true);
      renderAll();
    }

    const removePair = event.target.closest("[data-remove-pair]");
    if (removePair && block.content.pairs.length > 2) {
      block.content.pairs.splice(Number(removePair.dataset.removePair), 1);
      setDirty(true);
      renderAll();
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

bindEvents();
loadCourse().catch(() => {
  showToast("No se pudo cargar el curso.");
});
