# Compartilhamento e Google Drive

## Compartilhar a banda

Em **Nossa banda**, toque em **Compartilhar banda** e escolha WhatsApp, e-mail ou outro aplicativo instalado. O convite inclui o código da banda e o endereço do Shalom. Não inclui senha ou sessão de login.

Para incluir o endereço web do Cloudflare no APK, configure `VITE_PUBLIC_APP_URL` com sua URL HTTPS antes de compilar. Sem esse endereço, o APK usa a página de lançamentos no GitHub. Na web HTTPS, usa o endereço do próprio app. Se o navegador não tiver menu de compartilhamento, o convite é copiado para colar manualmente.

## Compartilhar uma partitura

Abra o PDF e toque no ícone de compartilhar, no topo do leitor. Será enviado o **PDF original**, sem os rabiscos e cifras locais. No Android, escolha o aplicativo de destino; ele recebe uma cópia do arquivo, sem precisar entrar na banda. O PDF no Supabase continua privado.

Na web/iPad, o compartilhamento de arquivos depende do navegador. Quando não estiver disponível, o app baixa o PDF para você compartilhar pela pasta Downloads. A cópia Android fica no cache privado e as cópias com mais de 24 horas são removidas no próximo compartilhamento.

## Importar do Google Drive no APK

1. Instale o Google Drive no Android e entre na conta que contém as partituras.
2. No Shalom, abra **Enviar partituras** ou **Adicionar partituras**, no repertório ou em Festividade.
3. Toque em **Importar do Google Drive**.
4. No seletor Android, abra o menu lateral e escolha **Google Drive** ou sua conta do Drive. A posição pode variar conforme o aparelho.
5. Selecione os PDFs. Você pode importar até 10 por seleção, com limite de 20 MB por arquivo e 100 MB no total. É preciso internet para buscar arquivos que não estejam disponíveis offline.
6. Confira o nome, grupo, dia quando for semanal e BPM. Depois toque em **Enviar para a banda** ou **Salvar neste aparelho**.

Selecionar um PDF ainda não o publica. Você pode cancelar antes de enviar. O app lê somente os arquivos escolhidos e não precisa de credenciais Google Cloud ou acesso a todo o Drive. Ele importa uma cópia: alterar o original no Drive não modifica a partitura já enviada ao Shalom.

O seletor próprio do Google Drive na versão web ficou para uma etapa futura. O botão Android usa o [seletor de documentos do sistema](https://developer.android.com/training/data-storage/shared/documents-files). O compartilhamento Android usa o [plugin oficial do Capacitor](https://capacitorjs.com/docs/apis/share).
