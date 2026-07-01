(function () {
  var api = null;
  var initialized = false;

  function findApi(win) {
    var attempts = 0;

    while (win && !win.API && win.parent && win.parent !== win && attempts < 500) {
      attempts += 1;
      win = win.parent;
    }

    return win && win.API ? win.API : null;
  }

  function getApi() {
    if (api) return api;

    api = findApi(window);

    if (!api && window.opener) {
      api = findApi(window.opener);
    }

    return api;
  }

  function call(method, value) {
    var runtimeApi = getApi();

    if (!runtimeApi || typeof runtimeApi[method] !== "function") {
      return "";
    }

    if (typeof value === "undefined") {
      return runtimeApi[method]("");
    }

    return runtimeApi[method].apply(runtimeApi, value);
  }

  window.ScormRuntime = {
    initialize: function () {
      if (initialized) return true;
      var result = call("LMSInitialize");
      initialized = result === "true" || result === true || !getApi();
      return initialized;
    },

    finish: function () {
      if (!initialized) return true;
      var result = call("LMSFinish");
      initialized = false;
      return result === "true" || result === true || !getApi();
    },

    getValue: function (key) {
      if (!initialized) this.initialize();
      return call("LMSGetValue", [key]) || "";
    },

    setValue: function (key, value) {
      if (!initialized) this.initialize();
      var result = call("LMSSetValue", [key, value]);
      return result === "true" || result === true || !getApi();
    },

    commit: function () {
      if (!initialized) this.initialize();
      var result = call("LMSCommit");
      return result === "true" || result === true || !getApi();
    }
  };
})();

