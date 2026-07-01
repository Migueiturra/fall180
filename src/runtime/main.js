(function () {
  var state = {
    course: null,
    currentLessonIndex: 0,
    unlockedLessonIndex: 0,
    completedLessons: {},
    lessonScreens: {},
    quizAnswers: {},
    score: 0
  };

  var els = {
    title: document.getElementById("course-title"),
    description: document.getElementById("course-description"),
    nav: document.getElementById("lesson-nav"),
    lesson: document.getElementById("lesson-container"),
    prev: document.getElementById("prev-button"),
    next: document.getElementById("next-button"),
    progressLabel: document.getElementById("progress-label"),
    progressBar: document.getElementById("progress-bar")
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

    Array.prototype.slice.call(template.content.querySelectorAll("*")).forEach(function (node) {
      if (allowedTags.indexOf(node.tagName) === -1) {
        node.replaceWith(document.createTextNode(node.textContent || ""));
        return;
      }

      Array.prototype.slice.call(node.attributes).forEach(function (attribute) {
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
    if (content[field + "Html"]) return sanitizeRichHtml(content[field + "Html"]);
    return escapeHtml(content[field] || "");
  }

  function embedUrl(url) {
    var value = String(url || "").trim();
    if (!value) return "";

    try {
      var parsed = new URL(value);
      var host = parsed.hostname.replace(/^www\./, "");

      if (host === "youtu.be") return "https://www.youtube.com/embed/" + parsed.pathname.replace("/", "");

      if (host === "youtube.com" || host === "m.youtube.com") {
        var videoId = parsed.searchParams.get("v");
        if (videoId) return "https://www.youtube.com/embed/" + videoId;
        if (parsed.pathname.indexOf("/embed/") === 0) return value;
        if (parsed.pathname.indexOf("/shorts/") === 0) return "https://www.youtube.com/embed/" + parsed.pathname.split("/")[2];
      }

      if (host === "vimeo.com") {
        var id = parsed.pathname.split("/").filter(Boolean)[0];
        if (id) return "https://player.vimeo.com/video/" + id;
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
    return "media-block media-" + size + " media-" + frame;
  }

  function aspectStyle(content) {
    return "aspect-ratio: " + escapeHtml(content.aspectRatio || "16 / 9");
  }

  function currentLesson() {
    return state.course.lessons[state.currentLessonIndex];
  }

  function screenCount(lesson) {
    return lesson.blocks.filter(function (block) { return block.type === "continue_button"; }).length + 1;
  }

  function revealedScreen(lesson) {
    return Math.min(state.lessonScreens[lesson.id] || 0, screenCount(lesson) - 1);
  }

  function blockScreenMap(lesson) {
    var screen = 0;
    return lesson.blocks.map(function (block) {
      var blockScreen = screen;
      if (block.type === "continue_button") screen += 1;
      return blockScreen;
    });
  }

  function isLessonComplete(lesson) {
    return !!state.completedLessons[lesson.id];
  }

  function isQuestionBlock(block) {
    return ["quiz_single_choice", "quiz_multiple_response", "quiz_fill_blank", "quiz_matching"].indexOf(block.type) !== -1;
  }

  function normalizeAnswer(value, caseSensitive) {
    var text = String(value || "").trim();
    return caseSensitive ? text : text.toLowerCase();
  }

  function arraysMatch(left, right) {
    var a = (left || []).slice().sort();
    var b = (right || []).slice().sort();
    if (a.length !== b.length) return false;
    return a.every(function (item, index) { return item === b[index]; });
  }

  function questionIsCorrect(block) {
    var answer = state.quizAnswers[block.id];
    if (block.type === "quiz_single_choice") return answer === block.content.correctAnswer;
    if (block.type === "quiz_multiple_response") return arraysMatch(answer, block.content.correctAnswers || []);
    if (block.type === "quiz_fill_blank") {
      return (block.content.answers || []).some(function (accepted) {
        return normalizeAnswer(answer, block.content.caseSensitive) === normalizeAnswer(accepted, block.content.caseSensitive);
      });
    }
    if (block.type === "quiz_matching") {
      var selected = answer || {};
      return (block.content.pairs || []).every(function (pair, index) {
        return selected[index] === pair.match;
      });
    }
    return true;
  }

  function requiredQuestionsComplete(lesson, maxScreen) {
    var map = blockScreenMap(lesson);
    return lesson.blocks.every(function (block, index) {
      if (!isQuestionBlock(block) || block.content.required === false) return true;
      if (typeof maxScreen === "number" && map[index] > maxScreen) return true;
      return questionIsCorrect(block);
    });
  }

  function loadSuspendData() {
    var raw = window.ScormRuntime.getValue("cmi.suspend_data");
    if (!raw) return;

    try {
      var saved = JSON.parse(raw);
      state.currentLessonIndex = saved.currentLessonIndex || 0;
      state.unlockedLessonIndex = saved.unlockedLessonIndex || saved.currentLessonIndex || 0;
      state.completedLessons = saved.completedLessons || {};
      state.lessonScreens = saved.lessonScreens || {};
      state.quizAnswers = saved.quizAnswers || {};
      state.score = saved.score || 0;
    } catch (error) {
      state.currentLessonIndex = 0;
      state.unlockedLessonIndex = 0;
    }
  }

  function saveProgress() {
    var progress = calculateProgress();
    var lesson = currentLesson();
    var lessonStatus = progress >= 100 ? "completed" : "incomplete";
    var passingScore = state.course.scorm && state.course.scorm.passingScore ? state.course.scorm.passingScore : 80;

    if (progress >= 100 && state.score >= passingScore) {
      lessonStatus = "passed";
    } else if (progress >= 100 && state.score > 0) {
      lessonStatus = "failed";
    }

    window.ScormRuntime.setValue("cmi.core.lesson_location", lesson.id);
    window.ScormRuntime.setValue("cmi.core.score.raw", String(state.score));
    window.ScormRuntime.setValue("cmi.core.lesson_status", lessonStatus);
    window.ScormRuntime.setValue("cmi.suspend_data", JSON.stringify({
      currentLessonIndex: state.currentLessonIndex,
      unlockedLessonIndex: state.unlockedLessonIndex,
      completedLessons: state.completedLessons,
      lessonScreens: state.lessonScreens,
      quizAnswers: state.quizAnswers,
      score: state.score
    }));
    window.ScormRuntime.commit();
  }

  function calculateProgress() {
    var total = 0;
    var completed = 0;
    state.course.lessons.forEach(function (lesson, index) {
      var screens = screenCount(lesson);
      total += screens;

      if (isLessonComplete(lesson)) {
        completed += screens;
      } else if (index === state.currentLessonIndex) {
        completed += revealedScreen(lesson) + 1;
      }
    });

    return total ? Math.round((completed / total) * 100) : 0;
  }

  function renderNav() {
    els.nav.innerHTML = state.course.lessons.map(function (lesson, index) {
      var active = index === state.currentLessonIndex ? " active" : "";
      var locked = index > state.unlockedLessonIndex ? " locked" : "";
      var status = isLessonComplete(lesson) ? "Completa" : index <= state.unlockedLessonIndex ? "Disponible" : "Bloqueada";
      return '<button class="lesson-tab' + active + locked + '" type="button" data-lesson="' + index + '"' + (locked ? " disabled" : "") + '>' +
        '<span class="lesson-number">' + (index + 1) + '</span>' +
        '<span class="lesson-name">' + escapeHtml(lesson.title) + '</span>' +
        '<span class="lesson-status">' + status + '</span>' +
        '</button>';
    }).join("");
  }

  function renderBlock(block) {
    if (block.type === "heading") {
      return '<article class="block reveal-block"><h2>' + richValue(block.content, "text") + '</h2></article>';
    }

    if (block.type === "paragraph") {
      return '<article class="block rich-output reveal-block">' + richValue(block.content, "text") + '</article>';
    }

    if (block.type === "image_text") {
      return '<article class="block image-text reveal-block">' +
        '<img src="' + escapeHtml(block.content.imageUrl) + '" alt="' + escapeHtml(block.content.imageAlt) + '">' +
        '<div><h3>' + escapeHtml(block.content.title) + '</h3><div class="rich-output">' + richValue(block.content, "text") + '</div></div>' +
        '</article>';
    }

    if (block.type === "statement") {
      return '<article class="block statement-block statement-' + escapeHtml(block.content.width || "normal") + ' reveal-block">' +
        (block.content.showDivider !== false ? '<span class="statement-rule"></span>' : '') +
        '<div class="rich-output">' + richValue(block.content, "text") + '</div>' +
        '</article>';
    }

    if (block.type === "divider") {
      return '<hr class="divider reveal-block">';
    }

    if (block.type === "embed") {
      var url = embedUrl(block.content.url);
      var media = isDirectVideo(url)
        ? '<video src="' + escapeHtml(url) + '" controls></video>'
        : '<iframe src="' + escapeHtml(url) + '" title="' + escapeHtml(block.content.title || "Recurso embebido") + '" allowfullscreen loading="lazy"></iframe>';

      return '<article class="block ' + mediaClass(block.content) + ' reveal-block">' +
        (block.content.title ? '<strong class="media-title">' + escapeHtml(block.content.title) + '</strong>' : '') +
        '<div class="media-shell" style="' + aspectStyle(block.content) + '">' + media + '</div>' +
        (block.content.caption ? '<p class="media-caption">' + escapeHtml(block.content.caption) + '</p>' : '') +
        '</article>';
    }

    if (block.type === "custom_html") {
      return '<article class="block ' + mediaClass(block.content) + ' reveal-block">' +
        (block.content.title ? '<strong class="media-title">' + escapeHtml(block.content.title) + '</strong>' : '') +
        '<iframe class="custom-html-frame" title="' + escapeHtml(block.content.title || "HTML custom") + '" sandbox="allow-scripts allow-forms allow-popups" srcdoc="' + escapeHtml(block.content.html || "") + '" style="' + aspectStyle(block.content) + '"></iframe>' +
        '</article>';
    }

    if (block.type === "quiz_single_choice") {
      var selected = state.quizAnswers[block.id];
      var options = block.content.options.map(function (option, index) {
        var checked = selected === index ? " checked" : "";
        return '<label class="quiz-option">' +
          '<input type="radio" name="' + escapeHtml(block.id) + '" value="' + index + '"' + checked + '>' +
          '<span>' + escapeHtml(option) + '</span>' +
          '</label>';
      }).join("");

      return '<article class="block quiz reveal-block" data-quiz="' + escapeHtml(block.id) + '">' +
        '<fieldset>' +
        '<legend>' + richValue(block.content, "question") + '</legend>' +
        options +
        '</fieldset>' +
        '<div class="quiz-actions"><button type="button" data-check-quiz="' + escapeHtml(block.id) + '">Revisar</button></div>' +
        '<div class="feedback" id="feedback-' + escapeHtml(block.id) + '"></div>' +
        '</article>';
    }

    if (block.type === "quiz_multiple_response") {
      var selectedMultiple = state.quizAnswers[block.id] || [];
      var multipleOptions = block.content.options.map(function (option, index) {
        var checked = selectedMultiple.indexOf(index) !== -1 ? " checked" : "";
        return '<label class="quiz-option">' +
          '<input type="checkbox" name="' + escapeHtml(block.id) + '" value="' + index + '"' + checked + '>' +
          '<span>' + escapeHtml(option) + '</span>' +
          '</label>';
      }).join("");

      return '<article class="block quiz reveal-block" data-quiz="' + escapeHtml(block.id) + '">' +
        '<fieldset>' +
        '<legend>' + richValue(block.content, "question") + '</legend>' +
        multipleOptions +
        '</fieldset>' +
        '<div class="quiz-actions"><button type="button" data-check-quiz="' + escapeHtml(block.id) + '">Revisar</button></div>' +
        '<div class="feedback" id="feedback-' + escapeHtml(block.id) + '"></div>' +
        '</article>';
    }

    if (block.type === "quiz_fill_blank") {
      var fillValue = state.quizAnswers[block.id] || "";
      return '<article class="block quiz reveal-block" data-quiz="' + escapeHtml(block.id) + '">' +
        '<fieldset>' +
        '<legend>' + richValue(block.content, "question") + '</legend>' +
        '<p>' + escapeHtml(block.content.prompt || "") + '</p>' +
        '<input class="fill-answer" type="text" data-fill-answer="' + escapeHtml(block.id) + '" value="' + escapeHtml(fillValue) + '">' +
        '</fieldset>' +
        '<div class="quiz-actions"><button type="button" data-check-quiz="' + escapeHtml(block.id) + '">Revisar</button></div>' +
        '<div class="feedback" id="feedback-' + escapeHtml(block.id) + '"></div>' +
        '</article>';
    }

    if (block.type === "quiz_matching") {
      var matchingValue = state.quizAnswers[block.id] || {};
      var matches = (block.content.pairs || []).map(function (pair) { return pair.match; });
      var rows = (block.content.pairs || []).map(function (pair, index) {
        return '<label class="matching-row">' +
          '<span>' + escapeHtml(pair.prompt) + '</span>' +
          '<select data-matching-answer="' + escapeHtml(block.id) + '" data-match-index="' + index + '">' +
            '<option value="">Selecciona</option>' +
            matches.map(function (match) {
              return '<option value="' + escapeHtml(match) + '"' + (matchingValue[index] === match ? " selected" : "") + '>' + escapeHtml(match) + '</option>';
            }).join("") +
          '</select>' +
          '</label>';
      }).join("");

      return '<article class="block quiz reveal-block" data-quiz="' + escapeHtml(block.id) + '">' +
        '<fieldset>' +
        '<legend>' + richValue(block.content, "question") + '</legend>' +
        rows +
        '</fieldset>' +
        '<div class="quiz-actions"><button type="button" data-check-quiz="' + escapeHtml(block.id) + '">Revisar</button></div>' +
        '<div class="feedback" id="feedback-' + escapeHtml(block.id) + '"></div>' +
        '</article>';
    }

    return "";
  }

  function renderContinue(block, screen, screens) {
    var lesson = currentLesson();
    var canContinue = requiredQuestionsComplete(lesson, screen);
    return '<article class="block continue-panel reveal-block">' +
      '<button class="continue-button" type="button" data-continue' + (canContinue ? "" : " disabled") + '>' + escapeHtml(block.content.label || "Continuar") + '</button>' +
      '</article>';
  }

  function renderNextUnit() {
    if (state.currentLessonIndex >= state.course.lessons.length - 1) {
      return '<article class="block continue-panel reveal-block"><strong>Curso completado.</strong></article>';
    }

    var canAdvance = requiredQuestionsComplete(currentLesson());
    return '<article class="block continue-panel reveal-block">' +
      '<button class="continue-button" type="button" data-next-unit' + (canAdvance ? "" : " disabled") + '>Ir a la siguiente unidad</button>' +
      '</article>';
  }

  function renderLesson() {
    var lesson = currentLesson();
    var screen = revealedScreen(lesson);
    var screens = screenCount(lesson);
    var map = blockScreenMap(lesson);

    if (screen >= screens - 1 && requiredQuestionsComplete(lesson)) {
      state.completedLessons[lesson.id] = true;
    }

    var blocks = lesson.blocks.map(function (block, index) {
      if (block.type === "continue_button") {
        if (map[index] === screen && screen < screens - 1) return renderContinue(block, screen, screens);
        return "";
      }

      return map[index] <= screen ? renderBlock(block) : "";
    }).join("");

    els.lesson.innerHTML = '<p class="lesson-title">Unidad ' + (state.currentLessonIndex + 1) + ' de ' + state.course.lessons.length + '</p>' +
      '<h2 class="unit-heading">' + escapeHtml(lesson.title) + '</h2>' +
      '<div class="unit-progress">' +
        '<span>Pantalla ' + (screen + 1) + ' de ' + screens + '</span>' +
        '<div><i style="width:' + Math.round(((screen + 1) / screens) * 100) + '%"></i></div>' +
      '</div>' +
      blocks +
      (screen >= screens - 1 ? renderNextUnit() : "");

    els.prev.disabled = state.currentLessonIndex === 0;
    els.next.disabled = state.currentLessonIndex >= state.unlockedLessonIndex || state.currentLessonIndex === state.course.lessons.length - 1;
    renderNav();
    renderProgress();
    saveProgress();
  }

  function renderProgress() {
    var progress = calculateProgress();
    els.progressLabel.textContent = progress + "%";
    els.progressBar.style.width = progress + "%";
  }

  function calculateScore() {
    var total = 0;
    var correct = 0;

    state.course.lessons.forEach(function (lesson) {
      lesson.blocks.forEach(function (block) {
        if (isQuestionBlock(block)) {
          total += 1;
          if (questionIsCorrect(block)) correct += 1;
        }
      });
    });

    state.score = total > 0 ? Math.round((correct / total) * 100) : 100;
  }

  function moveToLesson(index) {
    if (index < 0 || index >= state.course.lessons.length || index > state.unlockedLessonIndex) return;
    state.currentLessonIndex = index;
    renderLesson();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindEvents() {
    els.prev.addEventListener("click", function () {
      moveToLesson(state.currentLessonIndex - 1);
    });

    els.next.addEventListener("click", function () {
      moveToLesson(state.currentLessonIndex + 1);
    });

    els.nav.addEventListener("click", function (event) {
      var button = event.target.closest("[data-lesson]");
      if (!button) return;
      moveToLesson(Number(button.getAttribute("data-lesson")));
    });

    els.lesson.addEventListener("click", function (event) {
      if (event.target.closest("[data-continue]")) {
        var lesson = currentLesson();
        state.lessonScreens[lesson.id] = Math.min(revealedScreen(lesson) + 1, screenCount(lesson) - 1);
        renderLesson();
        var blocks = els.lesson.querySelectorAll(".reveal-block");
        if (blocks.length) blocks[blocks.length - 1].scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (event.target.closest("[data-next-unit]")) {
        if (!requiredQuestionsComplete(currentLesson())) return;
        state.unlockedLessonIndex = Math.max(state.unlockedLessonIndex, state.currentLessonIndex + 1);
        moveToLesson(state.currentLessonIndex + 1);
        return;
      }

      var button = event.target.closest("[data-check-quiz]");
      if (!button) return;

      var quizId = button.getAttribute("data-check-quiz");
      var quizBlock = findQuiz(quizId);
      var quizShell = button.closest("[data-quiz]");
      var feedback = document.getElementById("feedback-" + quizId);

      if (!quizBlock || !quizShell) {
        feedback.textContent = "No se pudo revisar la pregunta.";
        return;
      }

      if (quizBlock.type === "quiz_single_choice") {
        var selected = quizShell.querySelector('input[name="' + quizId + '"]:checked');
        if (!selected) {
          feedback.textContent = "Selecciona una alternativa.";
          return;
        }
        state.quizAnswers[quizId] = Number(selected.value);
      }

      if (quizBlock.type === "quiz_multiple_response") {
        state.quizAnswers[quizId] = Array.prototype.slice.call(quizShell.querySelectorAll('input[name="' + quizId + '"]:checked'))
          .map(function (input) { return Number(input.value); });
        if (!state.quizAnswers[quizId].length) {
          feedback.textContent = "Selecciona al menos una alternativa.";
          return;
        }
      }

      if (quizBlock.type === "quiz_fill_blank") {
        var fill = quizShell.querySelector("[data-fill-answer]");
        state.quizAnswers[quizId] = fill ? fill.value : "";
        if (!state.quizAnswers[quizId].trim()) {
          feedback.textContent = "Escribe una respuesta.";
          return;
        }
      }

      if (quizBlock.type === "quiz_matching") {
        var selectedMatches = {};
        Array.prototype.slice.call(quizShell.querySelectorAll("[data-matching-answer]")).forEach(function (select) {
          selectedMatches[select.getAttribute("data-match-index")] = select.value;
        });
        state.quizAnswers[quizId] = selectedMatches;
        if (Object.keys(selectedMatches).some(function (key) { return !selectedMatches[key]; })) {
          feedback.textContent = "Completa todas las coincidencias.";
          return;
        }
      }

      if (!questionIsCorrect(quizBlock)) {
        calculateScore();
        feedback.innerHTML = richValue(quizBlock.content, "feedbackIncorrect");
        renderProgress();
        saveProgress();
        return;
      }

      calculateScore();
      feedback.innerHTML = richValue(quizBlock.content, "feedbackCorrect");
      if (revealedScreen(currentLesson()) >= screenCount(currentLesson()) - 1 && requiredQuestionsComplete(currentLesson())) {
        state.completedLessons[currentLesson().id] = true;
      }
      saveProgress();
      Array.prototype.slice.call(els.lesson.querySelectorAll("[data-continue]")).forEach(function (item) {
        item.disabled = !requiredQuestionsComplete(currentLesson(), revealedScreen(currentLesson()));
      });
      Array.prototype.slice.call(els.lesson.querySelectorAll("[data-next-unit]")).forEach(function (item) {
        item.disabled = !requiredQuestionsComplete(currentLesson());
      });
      renderProgress();
    });

    window.addEventListener("beforeunload", function () {
      saveProgress();
      window.ScormRuntime.finish();
    });
  }

  function findQuiz(quizId) {
    var found = null;
    state.course.lessons.forEach(function (lesson) {
      lesson.blocks.forEach(function (block) {
        if (block.id === quizId) found = block;
      });
    });
    return found;
  }

  function init(course) {
    state.course = course;
    els.title.textContent = course.title;
    els.description.textContent = course.description;
    window.ScormRuntime.initialize();
    loadSuspendData();
    calculateScore();
    bindEvents();
    renderLesson();
  }

  fetch("course-data.json")
    .then(function (response) { return response.json(); })
    .then(init)
    .catch(function () {
      els.lesson.innerHTML = "<p>No se pudo cargar el curso.</p>";
    });
})();
