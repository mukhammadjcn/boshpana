import Script from "next/script";

import { PublicGamePage } from "@/components/public-game-page";
import { buildPublicMetadata, absoluteUrl } from "@/lib/site";

export const metadata = buildPublicMetadata({
  title: "Bunker o'yini — Jamoaviy.uz",
  description:
    "Bunker o'yini qoidalari, create configlari va Telegram orqali room yaratish oqimini Jamoaviy.uz ichida ko'ring.",
  path: "/games/bunker",
  image: "/bunkerbanner.webp",
  keywords: [
    "Bunker o'yini",
    "Bunker online",
    "Jamoaviy.uz bunker",
    "Telegram party game"
  ]
});

export default function BunkerPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Bunker o'yini — Jamoaviy.uz",
    url: absoluteUrl("/games/bunker"),
    description:
      "Bunker o'yini qoidalari, create configlari va Telegram orqali room yaratish oqimi.",
    inLanguage: "uz",
    mainEntity: {
      "@type": "Game",
      name: "Bunker",
      description:
        "Apokalipsisdan keyin bunkerga kim qolishini pitch va ovoz bilan hal qiladigan jamoaviy o'yin.",
      numberOfPlayers: "3-16"
    }
  };

  return (
    <>
      <Script
        id="bunker-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicGamePage
        eyebrow="bunker_apokalipsis_stol_oyini"
        title="bunker_kim_omon_qoladi"
        description="bunker_jamoaviy_muzokara_strategiya_va_b58a"
        image="/bunkerbanner.webp"
        imageAlt="bunker_oyini_banneri"
        heroStats={[
          { label: "oyinchi", value: "3-16" },
          { label: "davomiylik", value: "30_60_daq" },
          { label: "format", value: "pitch_vote" },
          { label: "platforma", value: "telegram" }
        ]}
        story={[
          {
            title: "nega_oynaladi",
            body: "bu_oyin_odamning_foydasi_riski_94e0"
          },
          {
            title: "asosiy_drama",
            body: "hammaning_kartasi_toliq_ochilmaydi_qaysi_1923"
          },
          {
            title: "host_uchun_foyda",
            body: "room_yaratish_juda_tez_faqat_0570"
          }
        ]}
        flow={[
          {
            title: "falokat_tanishtiriladi",
            body: "jamoa_bir_xil_krizisga_tushadi_99b5"
          },
          {
            title: "atributlar_bosqichma_bosqich_ochiladi",
            body: "kasb_sogliq_xarakter_skill_bagaj_02ad"
          },
          {
            title: "pitch_va_savol_javob",
            body: "har_kim_ozini_kerakli_odam_aaeb"
          },
          {
            title: "ovoz_va_chiqarish",
            body: "raund_oxirida_bitta_yoki_bir_6546"
          }
        ]}
        configs={[
          {
            label: "nickname",
            value: "host_nomi",
            reason: "bu_sozlama_lobbida_va_oyin_0a0b"
          },
          {
            label: "oyin_nechta_odam_qolganda_tugaydi",
            value: "1_2_3_kishi",
            reason: "bu_eng_muhim_bunker_configi_028c"
          },
          {
            label: "mavzu",
            value: "oddiy_yoki_18",
            reason: "kartalar_va_vaziyatlar_kayfiyatini_boshqaradi_0987"
          },
          {
            label: "lobby_havolasi",
            value: "room_code_share_link",
            reason: "room_ochilgach_tizim_kod_va_0efb"
          }
        ]}
        audience={[
          {
            title: "bahslashishni_yoqtiradigan_davralar",
            body: "agar_jamoa_bir_birini_gap_09fd"
          },
          {
            title: "katta_guruhlar",
            body: "3_dan_16_kishigacha_ishlagani_96d5"
          },
          {
            title: "hostga_yengil_format_kerak_bolsa",
            body: "murakkab_role_assignment_yoki_tun_eee8"
          }
        ]}
        createHref="/dashboard/create/bunker"
      />
    </>
  );
}
