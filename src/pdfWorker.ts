import './pdfPlatform';
import 'pdfjs-dist/legacy/build/pdf.worker.mjs';
self.postMessage({shalomPdfReady:true});
