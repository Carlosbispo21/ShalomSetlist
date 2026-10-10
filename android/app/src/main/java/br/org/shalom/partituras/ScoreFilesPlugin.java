package br.org.shalom.partituras;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.util.ArrayList;
import java.util.UUID;

@CapacitorPlugin(name = "ScoreFiles")
public class ScoreFilesPlugin extends Plugin {
    @PluginMethod public void pickPdfs(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/pdf");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        try { startActivityForResult(call, intent, "selected"); }
        catch (Exception error) { call.reject("Não foi possível abrir o seletor de arquivos.", error); }
    }
    @ActivityCallback private void selected(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject response = new JSObject(); response.put("files", new JSArray()); call.resolve(response); return;
        }
        Intent intent = result.getData();
        getBridge().execute(() -> {
            ArrayList<File> copies = new ArrayList<>();
            try {
                ArrayList<Uri> uris = new ArrayList<>();
                if (intent.getClipData() != null) {
                    for (int i=0; i<intent.getClipData().getItemCount(); i++) uris.add(intent.getClipData().getItemAt(i).getUri());
                } else if (intent.getData() != null) uris.add(intent.getData());
                if (uris.size() > 10) throw new IOException("Selecione até 10 PDFs por vez.");
                JSArray files = new JSArray(); long total = 0;
                for (Uri uri : uris) {
                    String name = "Partitura.pdf";
                    try (Cursor cursor = getContext().getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                        if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0)) name = cursor.getString(0);
                    }
                    if (!name.toLowerCase(java.util.Locale.ROOT).endsWith(".pdf")) throw new IOException("Escolha apenas arquivos PDF.");
                    File copy = new File(getContext().getCacheDir(), "shalom-import-" + UUID.randomUUID() + ".pdf"); copies.add(copy);
                    long size = 0;
                    try (InputStream in = getContext().getContentResolver().openInputStream(uri); OutputStream out = new FileOutputStream(copy)) {
                        if (in == null) throw new IOException("Não foi possível ler o PDF.");
                        byte[] buffer = new byte[65536]; int read;
                        while ((read=in.read(buffer)) != -1) {
                            size+=read; total+=read;
                            if (size > 20L*1024*1024 || total > 100L*1024*1024) throw new IOException("Limite de 20 MB por PDF e 100 MB por seleção.");
                            out.write(buffer,0,read);
                        }
                    }
                    JSObject file = new JSObject(); file.put("name", name); file.put("uri", Uri.fromFile(copy).toString()); files.put(file);
                }
                JSObject response = new JSObject(); response.put("files", files); call.resolve(response);
            } catch (Exception error) {
                for (File copy : copies) copy.delete();
                call.reject(error.getMessage(), error);
            }
        });
    }
}
