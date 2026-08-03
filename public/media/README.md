# Vídeos de ambiente

Esta pasta está vazia de propósito. Nenhum vídeo foi versionado — por peso do
arquivo e por direito de imagem das pessoas filmadas nos cultos.

**As duas telas funcionam sem nenhum arquivo aqui.** O componente
`components/media/AmbientVideo.tsx` renderiza sempre um fundo "catedral" feito
em CSS (luz de vitral, feixes oblíquos, brasa no altar, grão de filme). Se um
vídeo existir, ele entra por cima com fade de 2,2s. Se não existir, ninguém
percebe: não há buraco visual nem erro no console.

## Para ativar o vídeo

Coloque os arquivos com exatamente estes nomes:

| Arquivo | Uso |
|---|---|
| `ambient-worship.webm` | fonte preferida (VP9/AV1, menor) |
| `ambient-worship.mp4` | fallback para Safari/iOS (H.264) |
| `ambient-poster.jpg` | primeiro quadro, exibido enquanto carrega |

## Especificação recomendada

- **Duração:** 12–20s em loop perfeito (o primeiro e o último quadro devem casar)
- **Resolução:** 1920×1080 basta — o vídeo aparece com blur de 18–34px
- **Bitrate:** ≤ 2 Mbps. O arquivo é baixado em toda visita; acima disso a
  primeira pintura da tela sofre em 4G
- **Áudio:** remova a faixa. O vídeo toca com `muted` (exigência de autoplay) e
  o áudio só somaria peso
- **Conteúdo:** igreja iluminada, Bíblias, oração, louvor, pessoas adorando.
  Movimento lento — o `playbackRate` já é reduzido para 0.45–0.55
- **Enquadramento:** evite rostos em close no centro. O card de login cobre o
  meio da tela, e o blur transforma rostos reconhecíveis em manchas estranhas

## Direito de imagem

Se as filmagens tiverem membros identificáveis, colha autorização de uso de
imagem antes de publicar — inclusive de responsáveis, no caso de crianças. Um
plano fechado em Bíblia, vitral, cruz ou mãos levantadas costuma resolver a
atmosfera sem esse problema.

## Otimização

```bash
# WebM (VP9)
ffmpeg -i origem.mov -c:v libvpx-vp9 -b:v 1.6M -an -t 16 ambient-worship.webm

# MP4 (H.264, compatibilidade ampla)
ffmpeg -i origem.mov -c:v libx264 -profile:v high -crf 26 -pix_fmt yuv420p \
       -movflags +faststart -an -t 16 ambient-worship.mp4

# Poster
ffmpeg -i ambient-worship.mp4 -vframes 1 -q:v 3 ambient-poster.jpg
```
