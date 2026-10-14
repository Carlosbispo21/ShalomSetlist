package br.org.shalom.partituras;
import android.app.Notification;
import androidx.core.app.NotificationCompat;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.regex.Pattern;
public class ProgramNotificationsService extends NotificationListenerService {
    // Only programme-shaped WhatsApp text is retained. No contacts/history
    // are read. Android notification access is optional and off by default.
    private static final Pattern GROUP=Pattern.compile("(?m)^\\s*[*_]*(criancas|adolescentes|mocidade|jovens|varoes|irmas|avulsos|grupo de louvor)[*_]*\\s*:");
    @Override public void onNotificationPosted(StatusBarNotification sbn){
        String pkg=sbn.getPackageName();if(!"com.whatsapp".equals(pkg)&&!"com.whatsapp.w4b".equals(pkg))return;
        try{
            Notification notification=sbn.getNotification();Bundle extras=notification.extras;
            ArrayList<CharSequence> texts=new ArrayList<>();texts.add(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));texts.add(extras.getCharSequence(Notification.EXTRA_TEXT));
            NotificationCompat.MessagingStyle style=NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(notification);
            if(style!=null)for(NotificationCompat.MessagingStyle.Message message:style.getMessages())texts.add(message.getText());
            String latest="";
            for(CharSequence candidate:texts){
                if(candidate==null||candidate.length()>20000)continue;String text=candidate.toString();
                String norm=Normalizer.normalize(text,Normalizer.Form.NFD).replaceAll("\\p{M}","").toLowerCase(java.util.Locale.ROOT);
                java.util.regex.Matcher matcher=GROUP.matcher(norm);int groups=0;while(matcher.find())groups++;
                if(groups>=2||(groups>=1&&norm.contains("programacao")))latest=text;
            }
            if(latest.isEmpty())return;
            android.content.SharedPreferences prefs=getSharedPreferences(ProgramsPlugin.STORE,MODE_PRIVATE);
            if(latest.equals(prefs.getString("last-received","")))return;
            prefs.edit().putString("last-received",latest).apply();ProgramsPlugin.store(this,latest);
        }catch(Exception ignored){/* Missing/truncated notifications can still be shared manually. */}
    }
}
