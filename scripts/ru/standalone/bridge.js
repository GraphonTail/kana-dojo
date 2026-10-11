/*
 * KanaDojo RU standalone: glue between the web app and the Android shell.
 *
 * The Android app (scripts/ru/standalone/android) exposes `KanaDojoAndroid`.
 * Android WebView has no Web Speech API, so speechSynthesis is rebuilt here on
 * top of Android TextToSpeech; links to other sites open in the browser; file
 * downloads (the progress backup) go through the system "Save as" dialog.
 * In an ordinary browser this script does nothing.
 */
(function () {
  'use strict';
  var android = window.KanaDojoAndroid;
  if (!android || window.__kanaDojoBridge) return;
  window.__kanaDojoBridge = true;

  // ---------------------------------------------------------------- links
  function openExternal(href) {
    try {
      var url = new URL(href, location.href);
      if (url.origin === location.origin) return false;
      if (!/^(https?|mailto):$/.test(url.protocol)) return false;
      android.openExternal(url.href);
      return true;
    } catch {
      return false;
    }
  }

  var nativeOpen = window.open;
  window.open = function (url, target, features) {
    if (url && openExternal(String(url))) return null;
    return nativeOpen.call(window, url, target, features);
  };

  document.addEventListener(
    'click',
    function (event) {
      var target = event.target;
      var anchor = target && target.closest ? target.closest('a[href]') : null;
      if (!anchor || anchor.hasAttribute('download')) return;
      if (openExternal(anchor.href)) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true,
  );

  // ------------------------------------------------------------ downloads
  var blobs = {};
  var nativeCreateObjectURL = URL.createObjectURL;
  var nativeRevokeObjectURL = URL.revokeObjectURL;
  URL.createObjectURL = function (object) {
    var url = nativeCreateObjectURL.call(URL, object);
    if (object instanceof Blob) blobs[url] = object;
    return url;
  };
  URL.revokeObjectURL = function (url) {
    // Keep our own reference a little longer: the download reads it asynchronously.
    setTimeout(function () {
      delete blobs[url];
    }, 60000);
    return nativeRevokeObjectURL.call(URL, url);
  };

  function saveBlob(blob, name) {
    var reader = new FileReader();
    reader.onload = function () {
      var dataUrl = String(reader.result || '');
      var base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      android.saveFile(
        name || 'download',
        blob.type || 'application/octet-stream',
        base64,
      );
    };
    reader.readAsDataURL(blob);
  }

  var nativeAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute('download')) {
      var blob = blobs[this.href];
      if (blob) {
        saveBlob(blob, this.getAttribute('download'));
        return;
      }
      if (this.href.indexOf('data:') === 0) {
        fetch(this.href)
          .then(function (response) {
            return response.blob();
          })
          .then(
            function (data) {
              saveBlob(data, this.getAttribute('download'));
            }.bind(this),
          );
        return;
      }
    }
    return nativeAnchorClick.call(this);
  };

  // --------------------------------------------------------------- speech
  var voiceListeners = [];
  var utterances = {};
  var counter = 0;
  var voices = [];

  function loadVoices() {
    try {
      voices = JSON.parse(android.getVoices() || '[]').map(function (voice) {
        return {
          name: voice.name,
          lang: voice.lang,
          voiceURI: voice.name,
          localService: voice.localService !== false,
          default: !!voice.default,
        };
      });
    } catch {
      voices = [];
    }
  }

  function SpeechSynthesisUtterance(text) {
    this.text = text == null ? '' : String(text);
    this.lang = 'ja-JP';
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
    this.voice = null;
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
    this.onpause = null;
    this.onresume = null;
    this.onboundary = null;
    this.onmark = null;
    this._listeners = {};
  }
  SpeechSynthesisUtterance.prototype.addEventListener = function (
    type,
    listener,
  ) {
    (this._listeners[type] = this._listeners[type] || []).push(listener);
  };
  SpeechSynthesisUtterance.prototype.removeEventListener = function (
    type,
    listener,
  ) {
    var list = this._listeners[type];
    if (list) {
      this._listeners[type] = list.filter(function (item) {
        return item !== listener;
      });
    }
  };

  function emit(utterance, type, error) {
    var event = {
      type: type,
      utterance: utterance,
      error: error,
      charIndex: 0,
      elapsedTime: 0,
      name: '',
    };
    var handler = utterance['on' + type];
    try {
      if (typeof handler === 'function') handler.call(utterance, event);
    } catch (problem) {
      console.error(problem);
    }
    (utterance._listeners[type] || []).forEach(function (listener) {
      try {
        listener.call(utterance, event);
      } catch (problem) {
        console.error(problem);
      }
    });
  }

  function refreshState() {
    var ids = Object.keys(utterances);
    synth.speaking = ids.length > 0;
    synth.pending = ids.length > 1;
  }

  var synth = {
    speaking: false,
    pending: false,
    paused: false,
    onvoiceschanged: null,
    getVoices: function () {
      return voices.slice();
    },
    speak: function (utterance) {
      var id = 'kd' + ++counter;
      utterances[id] = utterance;
      refreshState();
      var voice = utterance.voice;
      android.speak(
        id,
        String(utterance.text || ''),
        String(utterance.lang || 'ja-JP'),
        Number(utterance.rate) || 1,
        Number(utterance.pitch) || 1,
        utterance.volume == null ? 1 : Number(utterance.volume),
        voice && voice.name ? String(voice.name) : '',
      );
    },
    cancel: function () {
      var pending = utterances;
      utterances = {};
      refreshState();
      android.stop();
      Object.keys(pending).forEach(function (id) {
        emit(pending[id], 'error', 'interrupted');
      });
    },
    pause: function () {},
    resume: function () {},
    addEventListener: function (type, listener) {
      if (type === 'voiceschanged') voiceListeners.push(listener);
    },
    removeEventListener: function (type, listener) {
      if (type === 'voiceschanged') {
        voiceListeners = voiceListeners.filter(function (item) {
          return item !== listener;
        });
      }
    },
    dispatchEvent: function () {
      return true;
    },
  };

  // Called from Android (TtsBridge.java).
  window.__kanaDojoTts = {
    onStart: function (id) {
      var utterance = utterances[id];
      if (utterance) emit(utterance, 'start');
    },
    onDone: function (id) {
      var utterance = utterances[id];
      if (!utterance) return;
      delete utterances[id];
      refreshState();
      emit(utterance, 'end');
    },
    onError: function (id, error) {
      var utterance = utterances[id];
      if (!utterance) return;
      delete utterances[id];
      refreshState();
      emit(utterance, 'error', error || 'synthesis-failed');
    },
    onVoicesChanged: function () {
      loadVoices();
      var event = { type: 'voiceschanged' };
      if (typeof synth.onvoiceschanged === 'function')
        synth.onvoiceschanged(event);
      voiceListeners.slice().forEach(function (listener) {
        try {
          listener(event);
        } catch (problem) {
          console.error(problem);
        }
      });
    },
  };

  loadVoices();
  try {
    Object.defineProperty(window, 'speechSynthesis', {
      value: synth,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: SpeechSynthesisUtterance,
      configurable: true,
      writable: true,
    });
  } catch {
    window.speechSynthesis = synth;
    window.SpeechSynthesisUtterance = SpeechSynthesisUtterance;
  }
})();
