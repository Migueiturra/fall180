const previewState = {
  course: null,
  courseId: new URLSearchParams(window.location.search).get("course") || "curso-demo-scorm",
  currentLessonIndex: 0,
  unlockedLessonIndex: 0,
  completedLessons: {},
  lessonScreens: {},
  quizAnswers: {}
};

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
  });
  return template.innerHTML;
}

function richValue(content, field) {
  if (content[`${field}Html`]) return sanitizeRichHtml(content[`${field}Html`]);
  return escapeHtml(content[field] || "");
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
    if (host === "youtu.be") return `https://www.youtube.com/embed/${parsed.pathname.replace("/", "")}`;
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
  return `media-block media-${content.size || "wide"} media-${content.hasFrame === false ? "no-frame" : "with-frame"}`;
}

function aspectStyle(content) {
  return `aspect-ratio: ${escapeHtml(content.aspectRatio || "16 / 9")}`;
}

function currentLesson() {
  return previewState.course.lessons[previewState.currentLessonIndex];
}

function screenCount(lesson) {
  return lesson.blocks.filter((block) => block.type === "continue_button").length + 1;
}

function revealedScreen(lesson) {
  return Math.min(previewState.lessonScreens[lesson.id] || 0, screenCount(lesson) - 1);
}

function blockScreenMap(lesson) {
  var screen = 0;
  return lesson.blocks.map((block) => {
    var blockScreen = screen;
    if (block.type === "continue_button") screen += 1;
    return blockScreen;
  });
}

function isLessonComplete(lesson) {
  return !!previewState.completedLessons[lesson.id];
}

function isQuestionBlock(block) {
  return ["quiz_single_choice", "quiz_multiple_response", "quiz_fill_blank", "quiz_matching"].includes(block.type);
}

function normalizeAnswer(value, caseSensitive) {
  var text = String(value || "").trim();
  return caseSensitive ? text : text.toLowerCase();
}

function arraysMatch(left, right) {
  var a = (left || []).slice().sort();
  var b = (right || []).slice().sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function questionIsCorrect(block) {
  var answer = previewState.quizAnswers[block.id];
  if (block.type === "quiz_single_choice") return answer === block.content.correctAnswer;
  if (block.type === "quiz_multiple_response") return arraysMatch(answer, block.content.correctAnswers || []);
  if (block.type === "quiz_fill_blank") {
    return (block.content.answers || []).some((accepted) => normalizeAnswer(answer, block.content.caseSensitive) === normalizeAnswer(accepted, block.content.caseSensitive));
  }
  if (block.type === "quiz_matching") {
    var selected = answer || {};
    return (block.content.pairs || []).every((pair, index) => selected[index] === pair.match);
  }
  return true;
}

function requiredQuestionsComplete(lesson, maxScreen) {
  var map = blockScreenMap(lesson);
  return lesson.blocks.every((block, index) => {
    if (!isQuestionBlock(block) || block.content.required === false) return true;
    if (typeof maxScreen === "number" && map[index] > maxScreen) return true;
    return questionIsCorrect(block);
  });
}

function calculateProgress() {
  var total = 0;
  var done = 0;
  previewState.course.lessons.forEach((lesson, index) => {
    var screens = screenCount(lesson);
    total += screens;
    if (isLessonComplete(lesson)) {
      done += screens;
    } else if (index === previewState.currentLessonIndex) {
      done += revealedScreen(lesson) + 1;
    }
  });
  return total ? Math.round((done / total) * 100) : 0;
}

function renderBlock(block) {
  if (block.type === "heading") return `<article class="preview-block fade-in"><h4>${richValue(block.content, "text")}</h4></article>`;
  if (block.type === "paragraph") return `<article class="preview-block rich-output fade-in">${richValue(block.content, "text")}</article>`;
  if (block.type === "image_text") {
    return `<article class="preview-block preview-image-text fade-in"><img src="${escapeHtml(resolveAsset(block.content.imageUrl))}" alt="${escapeHtml(block.content.imageAlt)}"><div><strong>${escapeHtml(block.content.title)}</strong><div class="rich-output">${richValue(block.content, "text")}</div></div></article>`;
  }
  if (block.type === "statement") {
    return `<article class="preview-block statement-block statement-${escapeHtml(block.content.width || "normal")} fade-in">${block.content.showDivider !== false ? `<span class="statement-rule"></span>` : ""}<div class="rich-output">${richValue(block.content, "text")}</div></article>`;
  }
  if (block.type === "divider") return `<hr class="preview-divider fade-in">`;
  if (block.type === "embed") {
    var url = embedUrl(block.content.url);
    var media = isDirectVideo(url) ? `<video src="${escapeHtml(url)}" controls></video>` : `<iframe src="${escapeHtml(url)}" title="${escapeHtml(block.content.title || "Recurso embebido")}" allowfullscreen loading="lazy"></iframe>`;
    return `<article class="preview-block ${mediaClass(block.content)} fade-in">${block.content.title ? `<strong class="media-title">${escapeHtml(block.content.title)}</strong>` : ""}<div class="media-shell" style="${aspectStyle(block.content)}">${media}</div>${block.content.caption ? `<p class="media-caption">${escapeHtml(block.content.caption)}</p>` : ""}</article>`;
  }
  if (block.type === "custom_html") {
    return `<article class="preview-block ${mediaClass(block.content)} fade-in">${block.content.title ? `<strong class="media-title">${escapeHtml(block.content.title)}</strong>` : ""}<iframe class="custom-html-frame" title="${escapeHtml(block.content.title || "HTML custom")}" sandbox="allow-scripts allow-forms allow-popups" srcdoc="${escapeHtml(block.content.html || "")}" style="${aspectStyle(block.content)}"></iframe></article>`;
  }
  if (block.type === "quiz_single_choice") {
    var selected = previewState.quizAnswers[block.id];
    return `<article class="preview-block preview-quiz fade-in" data-preview-quiz="${escapeHtml(block.id)}">
      <fieldset>
        <strong>${richValue(block.content, "question")}</strong>
        ${block.content.options.map((option, index) => `
          <label class="quiz-option-preview">
            <input type="radio" name="${escapeHtml(block.id)}" value="${index}"${selected === index ? " checked" : ""}>
            <span>${escapeHtml(option)}</span>
          </label>
        `).join("")}
      </fieldset>
      <button type="button" data-preview-check="${escapeHtml(block.id)}">Revisar</button>
      <div class="feedback" id="preview-feedback-${escapeHtml(block.id)}"></div>
    </article>`;
  }
  if (block.type === "quiz_multiple_response") {
    var selectedMultiple = previewState.quizAnswers[block.id] || [];
    return `<article class="preview-block preview-quiz fade-in" data-preview-quiz="${escapeHtml(block.id)}">
      <fieldset>
        <strong>${richValue(block.content, "question")}</strong>
        ${block.content.options.map((option, index) => `
          <label class="quiz-option-preview">
            <input type="checkbox" name="${escapeHtml(block.id)}" value="${index}"${selectedMultiple.includes(index) ? " checked" : ""}>
            <span>${escapeHtml(option)}</span>
          </label>
        `).join("")}
      </fieldset>
      <button type="button" data-preview-check="${escapeHtml(block.id)}">Revisar</button>
      <div class="feedback" id="preview-feedback-${escapeHtml(block.id)}"></div>
    </article>`;
  }
  if (block.type === "quiz_fill_blank") {
    return `<article class="preview-block preview-quiz fade-in" data-preview-quiz="${escapeHtml(block.id)}">
      <fieldset>
        <strong>${richValue(block.content, "question")}</strong>
        <p>${escapeHtml(block.content.prompt || "")}</p>
        <input class="fill-answer" type="text" data-fill-answer="${escapeHtml(block.id)}" value="${escapeHtml(previewState.quizAnswers[block.id] || "")}">
      </fieldset>
      <button type="button" data-preview-check="${escapeHtml(block.id)}">Revisar</button>
      <div class="feedback" id="preview-feedback-${escapeHtml(block.id)}"></div>
    </article>`;
  }
  if (block.type === "quiz_matching") {
    var matchingValue = previewState.quizAnswers[block.id] || {};
    var matches = (block.content.pairs || []).map((pair) => pair.match);
    return `<article class="preview-block preview-quiz fade-in" data-preview-quiz="${escapeHtml(block.id)}">
      <fieldset>
        <strong>${richValue(block.content, "question")}</strong>
        ${(block.content.pairs || []).map((pair, index) => `
          <label class="matching-row">
            <span>${escapeHtml(pair.prompt)}</span>
            <select data-matching-answer="${escapeHtml(block.id)}" data-match-index="${index}">
              <option value="">Selecciona</option>
              ${matches.map((match) => `<option value="${escapeHtml(match)}"${matchingValue[index] === match ? " selected" : ""}>${escapeHtml(match)}</option>`).join("")}
            </select>
          </label>
        `).join("")}
      </fieldset>
      <button type="button" data-preview-check="${escapeHtml(block.id)}">Revisar</button>
      <div class="feedback" id="preview-feedback-${escapeHtml(block.id)}"></div>
    </article>`;
  }
  return "";
}

function renderNav() {
  var nav = document.getElementById("preview-lesson-nav");
  nav.innerHTML = previewState.course.lessons.map((lesson, index) => {
    var active = index === previewState.currentLessonIndex ? " active" : "";
    var locked = index > previewState.unlockedLessonIndex ? " locked" : "";
    var complete = isLessonComplete(lesson) ? "Completa" : index <= previewState.unlockedLessonIndex ? "Disponible" : "Bloqueada";
    return `
      <button class="preview-nav-item${active}${locked}" type="button" data-preview-lesson="${index}"${locked ? " disabled" : ""}>
        <span>${index + 1}</span>
        <strong>${escapeHtml(lesson.title)}</strong>
        <small>${complete}</small>
      </button>
    `;
  }).join("");
}

function renderProgress() {
  var progress = calculateProgress();
  document.querySelector(".preview-progress span").textContent = `${progress}% complete`;
  document.querySelector(".preview-progress i").style.width = `${progress}%`;
}

function renderLesson() {
  var lesson = currentLesson();
  var screen = revealedScreen(lesson);
  var screens = screenCount(lesson);
  var map = blockScreenMap(lesson);

  if (screen >= screens - 1 && requiredQuestionsComplete(lesson)) {
    previewState.completedLessons[lesson.id] = true;
  }

  var visibleBlocks = lesson.blocks.map((block, index) => {
    if (block.type === "continue_button") {
      if (map[index] === screen && screen < screens - 1) {
        var canContinue = requiredQuestionsComplete(lesson, screen);
        return `<article class="preview-block preview-continue fade-in">
          <button class="continue-button" type="button" data-preview-continue${canContinue ? "" : " disabled"}>${escapeHtml(block.content.label || "Continuar")}</button>
        </article>`;
      }
      return "";
    }
    return map[index] <= screen ? renderBlock(block) : "";
  }).join("");

  document.getElementById("standalone-preview").innerHTML = `
    <section class="course-hero">
      <p class="eyebrow">Curso</p>
      <h2>${escapeHtml(previewState.course.title)}</h2>
      <p>${escapeHtml(previewState.course.description)}</p>
    </section>
    <section class="preview-lesson standalone-lesson">
      <p class="eyebrow">Unidad ${previewState.currentLessonIndex + 1} de ${previewState.course.lessons.length}</p>
      <h3>${escapeHtml(lesson.title)}</h3>
      <div class="unit-progress-mini">
        <span>Pantalla ${screen + 1} de ${screens}</span>
        <div><i style="width:${Math.round(((screen + 1) / screens) * 100)}%"></i></div>
      </div>
      ${visibleBlocks}
      ${screen >= screens - 1 ? renderNextUnitButton() : ""}
    </section>
  `;
  renderNav();
  renderProgress();
}

function renderNextUnitButton() {
  var hasNext = previewState.currentLessonIndex < previewState.course.lessons.length - 1;
  if (!hasNext) {
    return `<article class="preview-block preview-continue fade-in"><span>Curso completado en esta vista previa.</span></article>`;
  }
  var canAdvance = requiredQuestionsComplete(currentLesson());
  return `<article class="preview-block preview-continue fade-in">
    <button class="continue-button" type="button" data-preview-next-unit${canAdvance ? "" : " disabled"}>Ir a la siguiente unidad</button>
  </article>`;
}

function findQuiz(id) {
  for (var lesson of previewState.course.lessons) {
    for (var block of lesson.blocks) {
      if (block.id === id) return block;
    }
  }
  return null;
}

document.addEventListener("click", (event) => {
  var lessonButton = event.target.closest("[data-preview-lesson]");
  if (lessonButton) {
    previewState.currentLessonIndex = Number(lessonButton.dataset.previewLesson);
    renderLesson();
    return;
  }

  if (event.target.closest("[data-preview-continue]")) {
    var lesson = currentLesson();
    previewState.lessonScreens[lesson.id] = Math.min(revealedScreen(lesson) + 1, screenCount(lesson) - 1);
    renderLesson();
    document.querySelector(".standalone-lesson")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (event.target.closest("[data-preview-next-unit]")) {
    if (!requiredQuestionsComplete(currentLesson())) return;
    previewState.unlockedLessonIndex = Math.max(previewState.unlockedLessonIndex, previewState.currentLessonIndex + 1);
    previewState.currentLessonIndex += 1;
    renderLesson();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  var checkButton = event.target.closest("[data-preview-check]");
  if (!checkButton) return;
  var quizId = checkButton.dataset.previewCheck;
  var quizShell = checkButton.closest("[data-preview-quiz]");
  var feedback = document.getElementById(`preview-feedback-${quizId}`);
  var quiz = findQuiz(quizId);

  if (!quiz || !quizShell) {
    feedback.textContent = "No se pudo revisar la pregunta.";
    return;
  }

  if (quiz.type === "quiz_single_choice") {
    var selected = quizShell.querySelector(`input[name="${CSS.escape(quizId)}"]:checked`);
    if (!selected) {
      feedback.textContent = "Selecciona una alternativa.";
      return;
    }
    previewState.quizAnswers[quizId] = Number(selected.value);
  }

  if (quiz.type === "quiz_multiple_response") {
    previewState.quizAnswers[quizId] = [...quizShell.querySelectorAll(`input[name="${CSS.escape(quizId)}"]:checked`)].map((input) => Number(input.value));
    if (!previewState.quizAnswers[quizId].length) {
      feedback.textContent = "Selecciona al menos una alternativa.";
      return;
    }
  }

  if (quiz.type === "quiz_fill_blank") {
    var fill = quizShell.querySelector("[data-fill-answer]");
    previewState.quizAnswers[quizId] = fill ? fill.value : "";
    if (!previewState.quizAnswers[quizId].trim()) {
      feedback.textContent = "Escribe una respuesta.";
      return;
    }
  }

  if (quiz.type === "quiz_matching") {
    var selectedMatches = {};
    quizShell.querySelectorAll("[data-matching-answer]").forEach((select) => {
      selectedMatches[select.dataset.matchIndex] = select.value;
    });
    previewState.quizAnswers[quizId] = selectedMatches;
    if (Object.keys(selectedMatches).some((key) => !selectedMatches[key])) {
      feedback.textContent = "Completa todas las coincidencias.";
      return;
    }
  }

  feedback.innerHTML = questionIsCorrect(quiz) ? richValue(quiz.content, "feedbackCorrect") : richValue(quiz.content, "feedbackIncorrect");
  if (revealedScreen(currentLesson()) >= screenCount(currentLesson()) - 1 && requiredQuestionsComplete(currentLesson())) {
    previewState.completedLessons[currentLesson().id] = true;
  }
  document.querySelectorAll("[data-preview-continue]").forEach((item) => {
    item.disabled = !requiredQuestionsComplete(currentLesson(), revealedScreen(currentLesson()));
  });
  document.querySelectorAll("[data-preview-next-unit]").forEach((item) => {
    item.disabled = !requiredQuestionsComplete(currentLesson());
  });
  renderNav();
  renderProgress();
});

fetch(`/api/course?id=${encodeURIComponent(previewState.courseId)}`)
  .then((response) => response.json())
  .then((course) => {
    previewState.course = course;
    document.getElementById("preview-course-title").textContent = course.title;
    renderLesson();
  });
