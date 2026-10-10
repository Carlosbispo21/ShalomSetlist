package br.org.shalom.partituras;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;

public class MainActivity extends BridgeActivity {
    boolean reading = false;
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ReaderDisplayPlugin.class);
        super.onCreate(savedInstanceState);
        // Versões antigas tinham um service worker. Retira apenas o registro
        // dele, preservando login, PDFs e anotações, mesmo se ele servir HTML antigo.
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                view.evaluateJavascript("(async()=>{if('serviceWorker' in navigator){const r=await navigator.serviceWorker.getRegistrations();await Promise.all(r.map(s=>s.unregister()));if(navigator.serviceWorker.controller)location.reload();}})().catch(()=>{})", null);
            }
        });
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (reading) {
                    bridge.getWebView().evaluateJavascript("window.dispatchEvent(new Event('shalom-reader-back'))", null);
                } else {
                    setEnabled(false); getOnBackPressedDispatcher().onBackPressed(); setEnabled(true);
                }
            }
        });
    }
}
