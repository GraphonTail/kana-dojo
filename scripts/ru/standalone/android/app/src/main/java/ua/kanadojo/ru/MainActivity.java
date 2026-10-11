package ua.kanadojo.ru;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

import java.io.OutputStream;

/**
 * KanaDojo RU without the internet: the whole site is in assets/www and is
 * served to a WebView from https://appassets.androidplatform.net/.
 */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/";
    private static final int BACKGROUND = 0xFF151D32;
    private static final int REQUEST_PICK_FILE = 1;
    private static final int REQUEST_SAVE_FILE = 2;

    private WebView webView;
    private TtsBridge tts;
    private ValueCallback<Uri[]> pickCallback;
    private byte[] pendingSave;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BACKGROUND);
        webView = new WebView(this);
        webView.setBackgroundColor(BACKGROUND);
        root.addView(
                webView,
                new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), root);
        bars.setAppearanceLightStatusBars(false);
        bars.setAppearanceLightNavigationBars(false);

        // Keep the page clear of the status bar, navigation bar, cutouts and keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(
                root,
                (view, insets) -> {
                    Insets padding =
                            insets.getInsets(
                                    WindowInsetsCompat.Type.systemBars()
                                            | WindowInsetsCompat.Type.displayCutout()
                                            | WindowInsetsCompat.Type.ime());
                    view.setPadding(padding.left, padding.top, padding.right, padding.bottom);
                    return WindowInsetsCompat.CONSUMED;
                });

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setTextZoom(100);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        WebViewAssetLoader loader =
                new WebViewAssetLoader.Builder()
                        .setDomain(HOST)
                        .addPathHandler("/", new SiteHandler(getAssets()))
                        .build();

        webView.setWebViewClient(
                new WebViewClient() {
                    @Override
                    public WebResourceResponse shouldInterceptRequest(
                            WebView view, WebResourceRequest request) {
                        if (isPageDataRequest(request)) return notFound();
                        return loader.shouldInterceptRequest(request.getUrl());
                    }

                    @Override
                    public boolean shouldOverrideUrlLoading(
                            WebView view, WebResourceRequest request) {
                        Uri url = request.getUrl();
                        if (HOST.equals(url.getHost())) return false;
                        openExternal(url.toString());
                        return true;
                    }
                });

        webView.setWebChromeClient(
                new WebChromeClient() {
                    @Override
                    public boolean onShowFileChooser(
                            WebView view,
                            ValueCallback<Uri[]> callback,
                            FileChooserParams params) {
                        if (pickCallback != null) pickCallback.onReceiveValue(null);
                        pickCallback = callback;
                        Intent pick =
                                new Intent(Intent.ACTION_GET_CONTENT)
                                        .addCategory(Intent.CATEGORY_OPENABLE)
                                        .setType("*/*");
                        try {
                            startActivityForResult(pick, REQUEST_PICK_FILE);
                            return true;
                        } catch (ActivityNotFoundException missing) {
                            pickCallback = null;
                            return false;
                        }
                    }
                });

        tts = new TtsBridge(this, webView);
        webView.addJavascriptInterface(new AndroidApi(), "KanaDojoAndroid");

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher()
                    .registerOnBackInvokedCallback(
                            OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::goBack);
        }

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(START_URL);
        }
    }

    /**
     * Next.js sometimes asks for page data at the page URL itself ("/kanji?_rsc=…").
     * A static export only has that data in kanji.txt, so such requests must miss:
     * the router then loads kanji.txt instead of trying to read kanji.html as data.
     */
    private static boolean isPageDataRequest(WebResourceRequest request) {
        Uri url = request.getUrl();
        if (!HOST.equals(url.getHost())) return false;
        String last = url.getLastPathSegment();
        if (last != null && last.contains(".")) return false;
        if (url.getQueryParameter("_rsc") != null) return true;
        for (java.util.Map.Entry<String, String> header : request.getRequestHeaders().entrySet()) {
            if ("rsc".equalsIgnoreCase(header.getKey()) && "1".equals(header.getValue())) {
                return true;
            }
        }
        return false;
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse(
                "text/plain",
                "utf-8",
                404,
                "Not Found",
                new java.util.HashMap<>(),
                new java.io.ByteArrayInputStream(new byte[0]));
    }

    private void goBack() {
        if (webView.canGoBack()) webView.goBack();
        else finish();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        goBack();
    }

    private void openExternal(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (ActivityNotFoundException missing) {
            Toast.makeText(this, R.string.no_browser, Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_PICK_FILE) {
            if (pickCallback != null) {
                pickCallback.onReceiveValue(
                        WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                pickCallback = null;
            }
            return;
        }
        if (requestCode == REQUEST_SAVE_FILE) {
            byte[] bytes = pendingSave;
            pendingSave = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && bytes != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out == null) throw new java.io.IOException("No output stream");
                    out.write(bytes);
                    Toast.makeText(this, R.string.file_saved, Toast.LENGTH_SHORT).show();
                } catch (Exception failure) {
                    Toast.makeText(this, R.string.file_not_saved, Toast.LENGTH_LONG).show();
                }
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onPause() {
        super.onPause();
        tts.stop();
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        tts.shutdown();
        webView.destroy();
        super.onDestroy();
    }

    /** Methods the web page can call as window.KanaDojoAndroid (see bridge.js). */
    public final class AndroidApi {
        @JavascriptInterface
        public String getVoices() {
            return tts.voicesJson();
        }

        @JavascriptInterface
        public void speak(
                String id,
                String text,
                String lang,
                float rate,
                float pitch,
                float volume,
                String voice) {
            tts.speak(id, text, lang, rate, pitch, volume, voice);
        }

        @JavascriptInterface
        public void stop() {
            tts.stop();
        }

        @JavascriptInterface
        public void openExternal(String url) {
            runOnUiThread(() -> MainActivity.this.openExternal(url));
        }

        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            final byte[] bytes;
            try {
                bytes = Base64.decode(base64, Base64.DEFAULT);
            } catch (IllegalArgumentException broken) {
                return;
            }
            runOnUiThread(
                    () -> {
                        pendingSave = bytes;
                        Intent save =
                                new Intent(Intent.ACTION_CREATE_DOCUMENT)
                                        .addCategory(Intent.CATEGORY_OPENABLE)
                                        .setType(
                                                mime == null || mime.isEmpty()
                                                        ? "application/octet-stream"
                                                        : mime)
                                        .putExtra(Intent.EXTRA_TITLE, name);
                        try {
                            startActivityForResult(save, REQUEST_SAVE_FILE);
                        } catch (ActivityNotFoundException missing) {
                            pendingSave = null;
                            Toast.makeText(
                                            MainActivity.this,
                                            R.string.file_not_saved,
                                            Toast.LENGTH_LONG)
                                    .show();
                        }
                    });
        }
    }
}
