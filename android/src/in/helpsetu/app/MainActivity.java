package in.helpsetu.app;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * HelpSetu Android wrapper.
 *
 * The offline app is bundled under assets/ and works with no connection.
 * On launch the app quietly checks a small manifest on GitHub; when a newer
 * web bundle is published it is downloaded, checksum-verified and swapped in,
 * then the WebView reloads — no APK reinstall needed. If anything fails, the
 * existing (bundled or previously downloaded) copy keeps working offline.
 *
 * Calling is always through standard tel: links, which open the dialer with
 * the number filled in. The app never places a call itself.
 */
public class MainActivity extends Activity {
    private static final String COMMIT_API =
            "https://api.github.com/repos/chandramondal-1/Help-Setu/commits/main";
    private static final String RAW_BASE =
            "https://raw.githubusercontent.com/chandramondal-1/Help-Setu/";
    /** Version of the web files bundled inside this APK. */
    private static final int BUNDLED_WEB_VERSION = 10;

    /**
     * The WebView loads its files from a local https origin instead of file://.
     * That lets us disable all file and content access, so no page can read
     * unrelated files even if untrusted content ever reaches the WebView.
     * This is the reserved host used by WebViewAssetLoader; we serve the files
     * ourselves so the build stays dependency-free.
     */
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String APP_ORIGIN = "https://" + ASSET_HOST + "/";

    private static final Map<String, String> MIME = new HashMap<>();
    static {
        MIME.put("html", "text/html");
        MIME.put("css", "text/css");
        MIME.put("js", "application/javascript");
        MIME.put("json", "application/json");
        MIME.put("webmanifest", "application/manifest+json");
        MIME.put("svg", "image/svg+xml");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("jpeg", "image/jpeg");
        MIME.put("gif", "image/gif");
        MIME.put("ico", "image/x-icon");
        MIME.put("woff", "font/woff");
        MIME.put("woff2", "font/woff2");
        MIME.put("ttf", "font/ttf");
    }

    private static final ExecutorService UPDATER = Executors.newSingleThreadExecutor();

    private WebView web;
    private File webRoot;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setFitsSystemWindows(false);
        setContentView(web);
        hideSystemBars();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        // Serve app files from an intercepted https origin so no file:// or
        // content:// access is required or permitted.
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
            s.setMediaPlaybackRequiresUserGesture(true);
        }
        s.setUserAgentString(s.getUserAgentString() + " HelpSetuAndroid/1.2.4");

        final WebViewClient client = new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternalUrl(url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request != null && request.isForMainFrame()) {
                    return handleExternalUrl(request.getUrl().toString());
                }
                return false;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (request == null) return super.shouldInterceptRequest(view, request);
                Uri uri = request.getUrl();
                if (uri == null || !ASSET_HOST.equalsIgnoreCase(uri.getHost())) {
                    return super.shouldInterceptRequest(view, request);
                }
                return serveAsset(uri);
            }

            private boolean handleExternalUrl(String url) {
                if (url == null) return true;
                if (url.startsWith("tel:") || url.startsWith("sms:")) {
                    try {
                        Intent i = new Intent(Intent.ACTION_DIAL, Uri.parse(url));
                        startActivity(i);
                    } catch (Exception ignored) { }
                    return true;
                }
                if (url.startsWith(APP_ORIGIN) || url.startsWith("about:")) {
                    return false;
                }
                if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("mailto:")) {
                    try {
                        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(i);
                    } catch (Exception ignored) { }
                    return true;
                }
                // Block any other scheme (file:, javascript:, content:, etc.).
                return true;
            }
        };
        web.setWebViewClient(client);
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void checkUpdate() {
                checkForWebUpdate();
            }
        }, "HelpSetuNative");

        loadApp();
        checkForWebUpdate();
    }

    /** Draw under the notch and hide system bars so the app fills the whole screen. */
    private void hideSystemBars() {
        // Let content reach the physical cutout instead of leaving a black strip.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    private File webRoot() {
        if (webRoot == null) webRoot = new File(getFilesDir(), "webroot");
        return webRoot;
    }

    /** Load the app from the local https origin; serveAsset() picks the newest copy. */
    private void loadApp() {
        web.loadUrl(APP_ORIGIN + "index.html");
    }

    /**
     * Serve a file under the local app origin. A downloaded webroot takes
     * precedence over the bundled assets; nothing outside those two roots is
     * ever readable. Path traversal segments are rejected.
     */
    private WebResourceResponse serveAsset(Uri uri) {
        String path = uri.getPath();
        if (path == null || path.isEmpty() || "/".equals(path)) path = "/index.html";
        String rel = path;
        while (rel.startsWith("/")) rel = rel.substring(1);
        rel = rel.replace('\\', '/');
        // Reject traversal explicitly rather than silently normalising it.
        if (rel.isEmpty() || rel.contains("..")) return notFound();

        InputStream in = null;
        File local = new File(webRoot(), rel);
        try {
            if (local.isFile()) in = new FileInputStream(local);
        } catch (IOException ignored) { }
        if (in == null) {
            try {
                in = getAssets().open(rel);
            } catch (IOException ignored) { }
        }
        if (in == null) return notFound();

        int dot = rel.lastIndexOf('.');
        String ext = dot >= 0 ? rel.substring(dot + 1).toLowerCase() : "";
        String mime = MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream";
        String encoding = mime.startsWith("text/") || mime.endsWith("javascript")
                || mime.endsWith("json") || mime.endsWith("xml")
                ? "UTF-8" : null;
        return new WebResourceResponse(mime, encoding, in);
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                Collections.<String, String>emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    /** Quietly install a newer web bundle. Never blocks the UI or breaks offline use. */
    private void checkForWebUpdate() {
        UPDATER.execute(() -> {
            try {
                // Branch URLs are CDN-cached. Resolve the current commit through
                // the GitHub API, then use immutable SHA-pinned raw URLs.
                JSONObject commit = fetchJson(COMMIT_API + "?t=" + System.currentTimeMillis());
                String sha = commit.optString("sha", "");
                if (sha.isEmpty()) return;
                String base = RAW_BASE + sha + "/";

                JSONObject manifest = fetchJson(base + "android/update.json?t=" + System.currentTimeMillis());
                JSONObject info = manifest.optJSONObject("web");
                if (info == null) return;

                SharedPreferences prefs = getSharedPreferences("helpsetu", MODE_PRIVATE);
                int installed = prefs.getInt("web_version", BUNDLED_WEB_VERSION);
                int available = info.optInt("version", 0);
                if (available <= installed) return;

                String file = info.optString("file", "");
                String expected = info.optString("sha256", "");
                if (file.isEmpty() || expected.isEmpty()) return;

                File zip = new File(getFilesDir(), "web-bundle.zip");
                download(base + file, zip);
                if (!expected.equalsIgnoreCase(sha256(zip))) {
                    throw new IOException("checksum mismatch");
                }

                File staging = new File(getFilesDir(), "webroot_new");
                deleteRecursive(staging);
                unzip(zip, staging);
                if (!new File(staging, "index.html").exists()) {
                    throw new IOException("incomplete bundle");
                }

                File current = webRoot();
                if (current.exists()) deleteRecursive(current);
                if (!staging.renameTo(current)) throw new IOException("swap failed");

                prefs.edit().putInt("web_version", available).apply();
                runOnUiThread(() -> {
                    Toast.makeText(this, "HelpSetu updated", Toast.LENGTH_SHORT).show();
                    loadApp();
                });
            } catch (Exception ignored) {
                // Offline, blocked or bad manifest — keep the existing copy.
            }
        });
    }

    private static JSONObject fetchJson(String urlString) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(urlString).openConnection();
        c.setConnectTimeout(8000);
        c.setReadTimeout(15000);
        c.setRequestProperty("User-Agent", "HelpSetuAndroid/1.2.4");
        c.setRequestProperty("Accept", "application/vnd.github+json");
        try {
            if (c.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new IOException("HTTP " + c.getResponseCode());
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            InputStream in = c.getInputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
            in.close();
            return new JSONObject(out.toString("UTF-8"));
        } finally {
            c.disconnect();
        }
    }

    private static void download(String urlString, File target) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(urlString).openConnection();
        c.setConnectTimeout(8000);
        c.setReadTimeout(30000);
        c.setRequestProperty("User-Agent", "HelpSetuAndroid/1.2.4");
        try {
            if (c.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new IOException("HTTP " + c.getResponseCode());
            }
            InputStream in = c.getInputStream();
            FileOutputStream out = new FileOutputStream(target);
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
            out.close();
            in.close();
        } finally {
            c.disconnect();
        }
    }

    private static String sha256(File file) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        InputStream in = new FileInputStream(file);
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) != -1) md.update(buf, 0, n);
        in.close();
        StringBuilder sb = new StringBuilder();
        for (byte b : md.digest()) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    private static void unzip(File zip, File target) throws IOException {
        target.mkdirs();
        ZipInputStream zis = new ZipInputStream(new FileInputStream(zip));
        byte[] buf = new byte[8192];
        ZipEntry e;
        while ((e = zis.getNextEntry()) != null) {
            String name = e.getName();
            if (name.contains("..") || name.startsWith("/") || name.startsWith("\\")) continue;
            File out = new File(target, name);
            if (e.isDirectory()) {
                out.mkdirs();
            } else {
                File parent = out.getParentFile();
                if (parent != null) parent.mkdirs();
                FileOutputStream fos = new FileOutputStream(out);
                int n;
                while ((n = zis.read(buf)) != -1) fos.write(buf, 0, n);
                fos.close();
            }
            zis.closeEntry();
        }
        zis.close();
    }

    private static void deleteRecursive(File f) {
        if (f == null || !f.exists()) return;
        if (f.isDirectory()) {
            File[] kids = f.listFiles();
            if (kids != null) for (File k : kids) deleteRecursive(k);
        }
        f.delete();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
