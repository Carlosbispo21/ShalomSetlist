package br.org.shalom.partituras;

import android.content.Intent;
import android.net.Uri;
import android.view.WindowManager;
import android.view.ViewGroup;
import androidx.core.view.ViewCompat;
import com.getcapacitor.CapacitorWebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ReaderDisplay")
public class ReaderDisplayPlugin extends Plugin {
    @PluginMethod public void setReading(PluginCall call) {
        boolean reading = call.getBoolean("reading", false);
        getActivity().runOnUiThread(() -> {
            ((MainActivity) getActivity()).reading = reading;
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
                getActivity().getWindow(), getActivity().getWindow().getDecorView());
            if (reading) {
                ViewCompat.setOnApplyWindowInsetsListener(bridge.getWebView(), (view, insets) -> {
                    ViewGroup.MarginLayoutParams margins = (ViewGroup.MarginLayoutParams) view.getLayoutParams();
                    margins.setMargins(0, 0, 0, 0); view.setLayoutParams(margins);
                    return WindowInsetsCompat.CONSUMED;
                });
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsetsCompat.Type.systemBars());
            } else {
                ((CapacitorWebView) bridge.getWebView()).edgeToEdgeHandler(bridge);
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                controller.show(WindowInsetsCompat.Type.systemBars());
            }
            ViewCompat.requestApplyInsets(bridge.getWebView());
            call.resolve();
        });
    }
    @PluginMethod public void openApk(PluginCall call) {
        String url = call.getString("url", "");
        Uri uri = Uri.parse(url);
        boolean supabase = "vzccxwihuhcjydyjrzym.supabase.co".equals(uri.getHost())
            && uri.getPath().startsWith("/storage/v1/object/public/app-releases/") && uri.getPath().endsWith(".apk");
        boolean github = "github.com".equals(uri.getHost())
            && uri.getPath().matches("/Carlosbispo21/ShalomSetlist/releases/download/v[0-9]+\\.[0-9]+\\.[0-9]+/shalom-[0-9]+\\.[0-9]+\\.[0-9]+\\.apk");
        if (!"https".equals(uri.getScheme()) || !(supabase || github)) {
            call.reject("Endereço da atualização inválido"); return;
        }
        try {
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri)); call.resolve();
        } catch (Exception e) { call.reject("Não foi possível abrir o download", e); }
    }
}
