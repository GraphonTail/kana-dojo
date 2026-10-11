package ua.kanadojo.ru;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Android TextToSpeech behind the web app's speechSynthesis (see bridge.js):
 * WebView has no Web Speech API of its own.
 */
final class TtsBridge implements TextToSpeech.OnInitListener {
    private final Activity activity;
    private final WebView webView;
    private final TextToSpeech tts;
    private volatile boolean ready;
    private boolean installOffered;

    TtsBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.tts = new TextToSpeech(activity.getApplicationContext(), this);
    }

    @Override
    public void onInit(int status) {
        if (status != TextToSpeech.SUCCESS) return;
        ready = true;
        tts.setOnUtteranceProgressListener(
                new UtteranceProgressListener() {
                    @Override
                    public void onStart(String id) {
                        callJs("onStart", id, null);
                    }

                    @Override
                    public void onDone(String id) {
                        callJs("onDone", id, null);
                    }

                    @Override
                    @Deprecated
                    public void onError(String id) {
                        callJs("onError", id, "synthesis-failed");
                    }

                    @Override
                    public void onError(String id, int errorCode) {
                        callJs("onError", id, "synthesis-failed");
                    }

                    @Override
                    public void onStop(String id, boolean interrupted) {
                        callJs("onError", id, "interrupted");
                    }
                });
        callJs("onVoicesChanged", null, null);
    }

    /** Installed Japanese voices as JSON, offline ones first. */
    String voicesJson() {
        JSONArray result = new JSONArray();
        if (!ready) return result.toString();
        List<Voice> japanese = new ArrayList<>();
        try {
            Set<Voice> voices = tts.getVoices();
            if (voices != null) {
                for (Voice voice : voices) {
                    Locale locale = voice.getLocale();
                    Set<String> features = voice.getFeatures();
                    boolean notInstalled =
                            features != null
                                    && features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED);
                    if (locale != null && "ja".equals(locale.getLanguage()) && !notInstalled) {
                        japanese.add(voice);
                    }
                }
            }
        } catch (RuntimeException ignored) {
            // Some engines throw while they are still loading voices.
        }
        japanese.sort(
                (a, b) ->
                        Boolean.compare(
                                a.isNetworkConnectionRequired(), b.isNetworkConnectionRequired()));
        try {
            for (Voice voice : japanese) {
                JSONObject item = new JSONObject();
                item.put("name", voice.getName());
                item.put("lang", "ja-JP");
                item.put("localService", !voice.isNetworkConnectionRequired());
                item.put("default", result.length() == 0);
                result.put(item);
            }
            if (result.length() == 0) {
                // No Japanese voice installed yet: offer one anyway, speak() then
                // asks the user to install the voice data.
                JSONObject item = new JSONObject();
                item.put("name", "Japanese");
                item.put("lang", "ja-JP");
                item.put("localService", true);
                item.put("default", true);
                result.put(item);
            }
        } catch (JSONException ignored) {
            // Not reachable with constant keys.
        }
        return result.toString();
    }

    void speak(
            String id,
            String text,
            String lang,
            float rate,
            float pitch,
            float volume,
            String voiceName) {
        if (!ready) {
            callJs("onError", id, "not-ready");
            return;
        }
        Voice chosen = null;
        if (voiceName != null && !voiceName.isEmpty()) {
            try {
                Set<Voice> voices = tts.getVoices();
                if (voices != null) {
                    for (Voice voice : voices) {
                        if (voiceName.equals(voice.getName())) {
                            chosen = voice;
                            break;
                        }
                    }
                }
            } catch (RuntimeException ignored) {
                chosen = null;
            }
        }
        if (chosen == null || tts.setVoice(chosen) != TextToSpeech.SUCCESS) {
            Locale locale = Locale.forLanguageTag(lang == null || lang.isEmpty() ? "ja-JP" : lang);
            int available = tts.setLanguage(locale);
            if (available == TextToSpeech.LANG_MISSING_DATA
                    || available == TextToSpeech.LANG_NOT_SUPPORTED) {
                offerVoiceInstall();
                callJs("onError", id, "language-unavailable");
                return;
            }
        }
        tts.setSpeechRate(rate > 0 ? rate : 1f);
        tts.setPitch(pitch > 0 ? pitch : 1f);
        Bundle params = new Bundle();
        params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, Math.max(0f, Math.min(1f, volume)));
        if (tts.speak(text, TextToSpeech.QUEUE_ADD, params, id) != TextToSpeech.SUCCESS) {
            callJs("onError", id, "synthesis-failed");
        }
    }

    void stop() {
        if (ready) tts.stop();
    }

    void shutdown() {
        ready = false;
        tts.stop();
        tts.shutdown();
    }

    private void offerVoiceInstall() {
        activity.runOnUiThread(
                () -> {
                    Toast.makeText(activity, R.string.tts_missing, Toast.LENGTH_LONG).show();
                    if (installOffered) return;
                    installOffered = true;
                    try {
                        activity.startActivity(
                                new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA));
                    } catch (ActivityNotFoundException ignored) {
                        // The toast already says where to install the voice.
                    }
                });
    }

    private void callJs(String method, String id, String error) {
        StringBuilder args = new StringBuilder();
        if (id != null) args.append(JSONObject.quote(id));
        if (error != null) args.append(',').append(JSONObject.quote(error));
        String script =
                "window.__kanaDojoTts && window.__kanaDojoTts." + method + "(" + args + ")";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }
}
