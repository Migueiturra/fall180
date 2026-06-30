(function () {
  var state = { course: null, currentLessonIndex: 0, visitedLessons: {}, quizAnswers: {}, score: 0 };
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
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
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
    return "media-block media-" + (content.size || "wide") + " media-" + (content.hasFrame === false ? "no-frame" : "with-frame");
  }

  function aspectStyle(content) {
    return "aspect-ratio: " + escapeHtml(content.aspectRatio || "16 / 9");
  }

  function loadSuspendData() {
    var raw = window.ScormRuntime.getValue("cmi.suspend_data");
    if (!raw) return;
    try {
      var saved = JSON.parse(raw);
      state.currentLessonIndex = saved.currentLessonIndex || 0;
      state.visitedLessons = saved.visitedLessons || {};
      state.quizAnswers = saved.quizAnswers || {};
      state.score = saved.score || 0;
    } catch (error) {
      state.currentLessonIndex = 0;
    }
  }

  function saveProgress() {
    var progress = calculateProgress();
    var lesson = state.course.lessons[state.currentLessonIndex];
    var passingScore = state.course.scorm && state.course.scorm.passingScore ? state.course.scorm.passingScore : 80;
    var lessonStatus = progress >= 100 ? "completed" : "incomplete";
    if (progress >= 100 && state.score >= passingScore) lessonStatus = "passed";
    else if (progress >= 100 && state.score > 0) lessonStatus = "failed";
    window.ScormRuntime.setValue("cmi.core.lesson_location", lesson.id);
    window.ScormRuntime.setValue("cmi.core.score.raw", String(state.score));
    window.ScormRuntime.setValue("cmi.core.lesson_status", lessonStatus);
    window.ScormRuntime.setValue("cmi.suspend_data", JSON.stringify(state));
    window.ScormRuntime.commit();
  }

  function calculateProgress() {
    return Math.round((Object.keys(state.visitedLessons).length / state.course.lessons.length) * 100);
  }

  function renderNav() {
    els.nav.innerHTML = state.course.lessons.map(function (lesson, index) {
      var active = index === state.currentLessonIndex ? " active" : "";
      return '<button class="lesson-tab' + active + '" type="button" data-lesson="' + index + '"><span>' + escapeHtml(lesson.title) + '</span><span>' + (state.visitedLessons[lesson.id] ? "Visto" : "") + '</span></button>';
    }).join("");
  }

  function renderBlock(block) {
    if (block.type === "heading") return '<article class="block"><h2>' + richValue(block.content, "text") + '</h2></article>';
    if (block.type === "paragraph") return '<article class="block rich-output">' + richValue(block.content, "text") + '</article>';
    if (block.type === "image_text") return '<article class="block image-text"><img src="' + escapeHtml(block.content.imageUrl) + '" alt="' + escapeHtml(block.content.imageAlt) + '"><div><h3>' + escapeHtml(block.content.title) + '</h3><div class="rich-output">' + richValue(block.content, "text") + '</div></div></article>';
    if (block.type === "divider") return '<hr class="divider">';
    if (block.type === "embed") {
      var url = embedUrl(block.content.url);
      var media = isDirectVideo(url) ? '<video src="' + escapeHtml(url) + '" controls></video>' : '<iframe src="' + escapeHtml(url) + '" title="' + escapeHtml(block.content.title || "Recurso embebido") + '" allowfullscreen loading="lazy"></iframe>';
      return '<article class="block ' + mediaClass(block.content) + '">' + (block.content.title ? '<strong class="media-title">' + escapeHtml(block.content.title) + '</strong>' : '') + '<div class="media-shell" style="' + aspectStyle(block.content) + '">' + media + '</div>' + (block.content.caption ? '<p class="media-caption">' + escapeHtml(block.content.caption) + '</p>' : '') + '</article>';
    }
    if (block.type === "custom_html") return '<article class="block ' + mediaClass(block.content) + '">' + (block.content.title ? '<strong class="media-title">' + escapeHtml(block.content.title) + '</strong>' : '') + '<iframe class="custom-html-frame" title="' + escapeHtml(block.content.title || "HTML custom") + '" sandbox="allow-scripts allow-forms allow-popups" srcdoc="' + escapeHtml(block.content.html || "") + '" style="' + aspectStyle(block.content) + '"></iframe></article>';
    if (block.type === "quiz_single_choice") {
      var selected = state.quizAnswers[block.id];
      var options = block.content.options.map(function (option, index) {
        return '<label class="quiz-option"><input type="radio" name="' + escapeHtml(block.id) + '" value="' + index + '"' + (selected === index ? " checked" : "") + '><span>' + escapeHtml(option) + '</span></label>';
      }).join("");
      return '<article class="block quiz"><fieldset><legend>' + richValue(block.content, "question") + '</legend>' + options + '</fieldset><div class="quiz-actions"><button type="button" data-check-quiz="' + escapeHtml(block.id) + '">Revisar</button></div><div class="feedback" id="feedback-' + escapeHtml(block.id) + '"></div></article>';
    }
    return "";
  }

  function renderLesson() {
    var lesson = state.course.lessons[state.currentLessonIndex];
    state.visitedLessons[lesson.id] = true;
    els.lesson.innerHTML = '<p class="lesson-title">' + escapeHtml(lesson.title) + '</p>' + lesson.blocks.map(renderBlock).join("");
    els.prev.disabled = state.currentLessonIndex === 0;
    els.next.disabled = state.currentLessonIndex === state.course.lessons.length - 1;
    renderNav();
    var progress = calculateProgress();
    els.progressLabel.textContent = progress + "%";
    els.progressBar.style.width = progress + "%";
    saveProgress();
  }

  function calculateScore() {
    var total = 0;
    var correct = 0;
    state.course.lessons.forEach(function (lesson) {
      lesson.blocks.forEach(function (block) {
        if (block.type === "quiz_single_choice") {
          total += 1;
          if (state.quizAnswers[block.id] === block.content.correctAnswer) correct += 1;
        }
      });
    });
    state.score = total > 0 ? Math.round((correct / total) * 100) : 100;
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

  function bindEvents() {
    els.prev.addEventListener("click", function () { if (state.currentLessonIndex > 0) { state.currentLessonIndex -= 1; renderLesson(); } });
    els.next.addEventListener("click", function () { if (state.currentLessonIndex < state.course.lessons.length - 1) { state.currentLessonIndex += 1; renderLesson(); } });
    els.nav.addEventListener("click", function (event) { var button = event.target.closest("[data-lesson]"); if (button) { state.currentLessonIndex = Number(button.getAttribute("data-lesson")); renderLesson(); } });
    els.lesson.addEventListener("click", function (event) {
      var button = event.target.closest("[data-check-quiz]");
      if (!button) return;
      var quizId = button.getAttribute("data-check-quiz");
      var quizBlock = findQuiz(quizId);
      var selected = document.querySelector('input[name="' + quizId + '"]:checked');
      var feedback = document.getElementById("feedback-" + quizId);
      if (!selected || !quizBlock) { feedback.textContent = "Selecciona una alternativa."; return; }
      state.quizAnswers[quizId] = Number(selected.value);
      calculateScore();
      feedback.innerHTML = state.quizAnswers[quizId] === quizBlock.content.correctAnswer ? richValue(quizBlock.content, "feedbackCorrect") : richValue(quizBlock.content, "feedbackIncorrect");
      saveProgress();
    });
    window.addEventListener("beforeunload", function () { saveProgress(); window.ScormRuntime.finish(); });
  }

  fetch("course-data.json").then(function (response) { return response.json(); }).then(function (course) {
    state.course = course;
    els.title.textContent = course.title;
    els.description.textContent = course.description;
    window.ScormRuntime.initialize();
    loadSuspendData();
    bindEvents();
    renderLesson();
  }).catch(function () {
    els.lesson.innerHTML = "<p>No se pudo cargar el curso.</p>";
  });
})();
