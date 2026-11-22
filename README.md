# PRIME-XR
Starter do PRIME-XR com interface inspirada no Meta Quest.

## Desenvolvimento
- Node.js 20+
- npm install
- npm run dev
- npm run build

## APK via GitHub Actions
Envie o projeto ao GitHub e execute o workflow **Build PRIME-XR APK** na aba Actions. Baixe o artefato PRIME-XR-debug-apk.

## Limitações da primeira versão
MediaPipe requer câmera, permissão e conexão para baixar a biblioteca. Google e outros sites podem bloquear iframe; use Abrir fora. O áudio é sintetizado para protótipo. Recursos WebXR/headset e permissões Android nativas precisam de implementação e teste posteriores.