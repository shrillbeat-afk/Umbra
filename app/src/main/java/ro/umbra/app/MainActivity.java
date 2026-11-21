package ro.umbra.app;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.graphics.Color;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.window.OnBackInvokedDispatcher;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends Activity {
    private static final int CAMERA_PERMISSION_REQUEST = 41;
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String APP_URL = "https://" + APP_HOST + "/assets/index.html";
    private static final int BACKGROUND = Color.rgb(11, 13, 19);

    private WebView webView;
    private PermissionRequest pendingCameraRequest;
    private NativeBridge bridge;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        // Până la Android 14 culorile barelor de sistem se setează aici.
        // De la Android 15 (API 35) aplicația se desenează edge-to-edge, iar marginile se tratează prin insets.
        if (Build.VERSION.SDK_INT < 35) {
            getWindow().setStatusBarColor(BACKGROUND);
            getWindow().setNavigationBarColor(BACKGROUND);
        }

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        webView.setBackgroundColor(BACKGROUND);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Aplicația rămâne doar pe conținutul ei local; orice altă adresă este blocată.
                return !APP_HOST.equals(request.getUrl().getHost());
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> handleWebPermission(request));
            }
        });

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(BACKGROUND);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int left;
            int top;
            int right;
            int bottom;
            if (Build.VERSION.SDK_INT >= 30) {
                Insets bars = insets.getInsets(
                        WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                left = bars.left;
                top = bars.top;
                right = bars.right;
                bottom = bars.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = insets.getSystemWindowInsetBottom();
            }
            view.setPadding(left, top, right, bottom);
            return insets;
        });
        bridge = new NativeBridge();
        webView.addJavascriptInterface(bridge, "UmbraNative");
        setContentView(root);

        // Gestul „înapoi” predictiv (Android 13+): onBackPressed() nu mai este apelat când callback-ul e înregistrat.
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        }

        webView.loadUrl(APP_URL);
    }

    private void handleBack() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            finish();
        }
    }

    private void handleWebPermission(PermissionRequest request) {
        // Cererile de permisiuni sunt acceptate doar de la conținutul local al aplicației.
        if (request.getOrigin() == null || !APP_HOST.equals(request.getOrigin().getHost())) {
            request.deny();
            return;
        }
        boolean asksForCamera = false;
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) asksForCamera = true;
        }
        if (!asksForCamera) {
            request.deny();
            return;
        }
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } else {
            pendingCameraRequest = request;
            requestPermissions(new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST && pendingCameraRequest != null) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                pendingCameraRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            } else {
                pendingCameraRequest.deny();
            }
            pendingCameraRequest = null;
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // Folosit pe Android 12 și mai vechi.
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onPause() {
        if (bridge != null) bridge.stop();
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (bridge != null) bridge.start();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.destroy();
        }
        super.onDestroy();
    }

    /**
     * Punte către pagina locală (obiectul JavaScript „UmbraNative”).
     * Expune doar: citirea senzorului magnetic (câmpul real măsurat de telefon) și distribuirea unui text ales de utilizator.
     * Pagina încărcată este doar cea locală a aplicației (navigarea externă este blocată).
     */
    private class NativeBridge implements SensorEventListener {
        private final SensorManager sensorManager;
        private final Sensor magnetometer;
        private volatile float x;
        private volatile float y;
        private volatile float z;
        private volatile boolean hasReading;

        NativeBridge() {
            sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
            magnetometer = sensorManager == null ? null : sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        }

        void start() {
            if (sensorManager != null && magnetometer != null) {
                sensorManager.registerListener(this, magnetometer, SensorManager.SENSOR_DELAY_UI);
            }
        }

        void stop() {
            if (sensorManager != null) sensorManager.unregisterListener(this);
            hasReading = false;
        }

        @Override
        public void onSensorChanged(SensorEvent event) {
            x = event.values[0];
            y = event.values[1];
            z = event.values[2];
            hasReading = true;
        }

        @Override
        public void onAccuracyChanged(Sensor sensor, int accuracy) {
            // nefolosit
        }

        @JavascriptInterface
        public boolean hasEmf() {
            return magnetometer != null;
        }

        /** Returnează „x,y,z” în microtesla sau un șir gol dacă nu există încă o citire. */
        @JavascriptInterface
        public String emf() {
            return hasReading ? (x + "," + y + "," + z) : "";
        }

        @JavascriptInterface
        public void share(String title, String text) {
            final String safeTitle = title == null ? "Raport Umbra" : title;
            final String safeText = text == null ? "" : text;
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_SUBJECT, safeTitle);
                send.putExtra(Intent.EXTRA_TEXT, safeText);
                startActivity(Intent.createChooser(send, safeTitle));
            });
        }
    }
}
