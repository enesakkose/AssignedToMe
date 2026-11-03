# AssignedToMe logo — kullanım kılavuzu

**Fikir:** Yığından öne çekilen işin boşalttığı yerde sen varsın. Üç çubuk birçok board'dan gelen işleri, öne çekilen çubuk senin işini, nokta seni temsil eder.

## Dosyalar

| Dosya | Ne için |
|---|---|
| `mytask-symbol.svg` | Ana sembol (24 px ve üstü); diğer renk ve boyutlar bundan üretilir |
| `mytask-symbol-small.svg` | Küçük boyut çizimi (24 px ve altı: menubar, uygulama başlığı); çubuklar kalın, boşluklar geniş |
| `mytask-macos-icon.svg` | macOS uygulama ikonu (1024, macOS ızgarası); `tauri icon` bunun PNG'sinden üretilir |
| `export/mytask-macos-icon.png` | Uygulama ikonunun PNG'si |
| `export/tray/` | Menubar şablon ikonu (44 px = 22 pt @2x, siyah, saydam) |

## Renk

| Rol | HEX | RGB |
|---|---|---|
| Grafit (zemin, tek renk) | `#2B2D31` | 43, 45, 49 |
| Gümüş (koyu zeminde işaret) | `#E4E5E7` | 228, 229, 231 |
| Siyah / beyaz | `#000000` / `#FFFFFF` | tek renk baskı ve şablon ikon |

Logo renksizdir (Titanyum paleti). Uygulama içindeki durum renkleri (yeşil, kırmızı, kehribar) logoda kullanılmaz.

## Boşluk ve boyut

- **Güvenli alan:** sembolün her yanında en az bir **nokta çapı** kadar boşluk bırak (256'lık sembolde 50 birim).
- **Minimum boyut:** sembol 16 px (24 px ve altında `-small` çizimi).

## Zeminler

- Açık zeminde siyah ya da grafit; koyu zeminde beyaz ya da gümüş.
- Uygulama ikonu: grafit kare, gümüş işaret.
- Fotoğraf üstünde yalnızca sakin, düz bir alanda.

## Yapma

- Çubukları ya da noktayı yeniden boyama, renklendirme, gradyan ekleme.
- Noktayı silme ya da çubuğa bitiştirme (fikir noktadadır).
- Ortadaki çubuğu diğerleriyle hizalama (öne çekilmiş durması şart).
- Sembolü döndürme, eğme, gölge ya da kontur ekleme.

## Notlar

- Marka tescili için profesyonel bir arama (TÜRKPATENT, WIPO, ters görsel arama) önerilir; bu çalışma bir tescil garantisi değildir.
- Tasarım dosyaları skill'in `svg_audit` kontrolünden 100/100 geçti.
