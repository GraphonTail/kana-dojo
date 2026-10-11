package ua.kanadojo.ru;

import android.content.res.AssetManager;
import android.webkit.WebResourceResponse;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.webkit.WebViewAssetLoader;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Serves the exported site from assets/www the way a static web server would:
 * "/" is index.html, "/kana" is kana.html (or kana/index.html), files are
 * served as they are, and unknown pages get 404.html.
 */
final class SiteHandler implements WebViewAssetLoader.PathHandler {
    private static final Map<String, String> MIME_TYPES = new HashMap<>();

    static {
        MIME_TYPES.put("html", "text/html");
        MIME_TYPES.put("js", "application/javascript");
        MIME_TYPES.put("mjs", "application/javascript");
        MIME_TYPES.put("css", "text/css");
        MIME_TYPES.put("json", "application/json");
        MIME_TYPES.put("webmanifest", "application/manifest+json");
        MIME_TYPES.put("map", "application/json");
        // Next.js page data for client-side navigation.
        MIME_TYPES.put("txt", "text/x-component");
        MIME_TYPES.put("woff2", "font/woff2");
        MIME_TYPES.put("woff", "font/woff");
        MIME_TYPES.put("ttf", "font/ttf");
        MIME_TYPES.put("otf", "font/otf");
        MIME_TYPES.put("svg", "image/svg+xml");
        MIME_TYPES.put("png", "image/png");
        MIME_TYPES.put("jpg", "image/jpeg");
        MIME_TYPES.put("jpeg", "image/jpeg");
        MIME_TYPES.put("gif", "image/gif");
        MIME_TYPES.put("webp", "image/webp");
        MIME_TYPES.put("avif", "image/avif");
        MIME_TYPES.put("ico", "image/x-icon");
        MIME_TYPES.put("opus", "audio/ogg");
        MIME_TYPES.put("ogg", "audio/ogg");
        MIME_TYPES.put("mp3", "audio/mpeg");
        MIME_TYPES.put("wav", "audio/wav");
        MIME_TYPES.put("m4a", "audio/mp4");
        MIME_TYPES.put("mp4", "video/mp4");
        MIME_TYPES.put("xml", "application/xml");
        MIME_TYPES.put("wasm", "application/wasm");
    }

    private final AssetManager assets;

    SiteHandler(AssetManager assets) {
        this.assets = assets;
    }

    @Nullable
    @Override
    public WebResourceResponse handle(@NonNull String path) {
        String clean = path;
        while (clean.startsWith("/")) clean = clean.substring(1);
        while (clean.endsWith("/")) clean = clean.substring(0, clean.length() - 1);
        if (clean.contains("..")) return empty(404, "Not Found");

        String last = clean.substring(clean.lastIndexOf('/') + 1);
        List<String> candidates = new ArrayList<>();
        boolean page;
        if (clean.isEmpty()) {
            candidates.add("index.html");
            page = true;
        } else if (last.contains(".")) {
            candidates.add(clean);
            page = false;
        } else {
            candidates.add(clean + ".html");
            candidates.add(clean + "/index.html");
            page = true;
        }

        for (String candidate : candidates) {
            InputStream stream = open(candidate);
            if (stream != null) return response(candidate, stream, 200, "OK");
        }
        if (page) {
            InputStream notFound = open("404.html");
            if (notFound != null) return response("404.html", notFound, 404, "Not Found");
        }
        return empty(404, "Not Found");
    }

    @Nullable
    private InputStream open(String file) {
        try {
            return assets.open("www/" + file);
        } catch (IOException missing) {
            return null;
        }
    }

    private static WebResourceResponse response(
            String file, InputStream data, int status, String reason) {
        String extension = file.substring(file.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        String mime = MIME_TYPES.get(extension);
        if (mime == null) mime = "application/octet-stream";
        boolean text =
                mime.startsWith("text/")
                        || mime.equals("application/javascript")
                        || mime.equals("application/json");
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-cache");
        return new WebResourceResponse(mime, text ? "utf-8" : null, status, reason, headers, data);
    }

    private static WebResourceResponse empty(int status, String reason) {
        return new WebResourceResponse(
                "text/plain", "utf-8", status, reason, new HashMap<>(), new java.io.ByteArrayInputStream(new byte[0]));
    }
}
