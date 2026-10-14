package br.org.shalom.partituras;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
@CapacitorPlugin(name="Programs")
public class ProgramsPlugin extends Plugin {
    static final String STORE="shalom-programs";
    static void store(Context context,String text){if(text!=null&&!text.trim().isEmpty()&&text.length()<=20000)context.getSharedPreferences(STORE,Context.MODE_PRIVATE).edit().putString("pending",text).apply();}
    @PluginMethod public void pending(PluginCall call){JSObject result=new JSObject();result.put("text",getContext().getSharedPreferences(STORE,Context.MODE_PRIVATE).getString("pending",""));call.resolve(result);}
    @PluginMethod public void clear(PluginCall call){android.content.SharedPreferences prefs=getContext().getSharedPreferences(STORE,Context.MODE_PRIVATE);String expected=call.getString("text",null);if(expected!=null&&expected.equals(prefs.getString("pending","")))prefs.edit().remove("pending").apply();call.resolve();}
    @PluginMethod public void status(PluginCall call){JSObject result=new JSObject();result.put("enabled",NotificationManagerCompat.getEnabledListenerPackages(getContext()).contains(getContext().getPackageName()));call.resolve(result);}
    @PluginMethod public void settings(PluginCall call){try{getActivity().startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));call.resolve();}catch(Exception e){call.reject("Abra Ajustes do Android → Acesso às notificações.");}}
}
