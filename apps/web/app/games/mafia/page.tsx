import Script from "next/script";

import { PublicGamePage } from "@/components/public-game-page";
import { buildPublicMetadata, absoluteUrl } from "@/lib/site";

export const metadata = buildPublicMetadata({
  title: "Mafia o'yini — Jamoaviy.uz",
  description:
    "Mafia o'yini qoidalari, role balanslari va Telegram orqali room yaratish configlarini Jamoaviy.uz ichida ko'ring.",
  path: "/games/mafia",
  image: "/mafiabanner.webp",
  keywords: [
    "Mafia o'yini",
    "Mafia online",
    "Jamoaviy.uz mafia",
    "Telegram party game"
  ]
});

export default function MafiaPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Mafia o'yini — Jamoaviy.uz",
    url: absoluteUrl("/games/mafia"),
    description:
      "Mafia o'yini qoidalari, role balanslari va Telegram orqali room yaratish oqimi.",
    inLanguage: "uz",
    mainEntity: {
      "@type": "Game",
      name: "Mafia",
      description:
        "Kun va tun rejimida yashirin rollar bilan xiyonatkorlarni topishga qurilgan jamoaviy o'yin.",
      numberOfPlayers: "4-16"
    }
  };

  return (
    <>
      <Script
        id="mafia-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicGamePage
        eyebrow="mafia_kun_va_tun_strategiyasi"
        title="mafia_kim_xiyonatkor"
        description="mafia_yashirin_rollar_kuzatuv_va_2f21"
        image="/mafiabanner.webp"
        imageAlt="mafia_oyini_banneri"
        heroStats={[
          { label: "oyinchi", value: "4-16" },
          { label: "davomiylik", value: "30_45_daq" },
          { label: "format", value: "night_day" },
          { label: "platforma", value: "telegram" }
        ]}
        story={[
          {
            title: "nega_oynaladi",
            body: "mafia_kuzatish_yolgonni_ushlash_va_b10f"
          },
          {
            title: "asosiy_drama",
            body: "bir_xil_gapni_ikki_xil_e631"
          },
          {
            title: "host_uchun_foyda",
            body: "role_composition_oldindan_korinadi_mafia_00a7"
          }
        ]}
        flow={[
          {
            title: "role_taqsimoti",
            body: "room_ichidagi_har_bir_oyinchi_1b50"
          },
          {
            title: "tun_fazasi",
            body: "mafia_nishon_tanlaydi_komisar_tekshiradi_365e"
          },
          {
            title: "kun_muhokamasi",
            body: "tun_natijasidan_keyin_hamma_versiya"
          },
          {
            title: "ovoz_bilan_chetlatish",
            body: "jamoa_shubhali_odamni_chiqaradi_mafia_955f"
          }
        ]}
        configs={[
          {
            label: "nickname",
            value: "host_nomi",
            reason: "room_egasini_korsatadi_va_lobbida_kimga_ergashish"
          },
          {
            label: "maks_oyinchi",
            value: "4_dan_16_gacha",
            reason: "davra_kattaligi_role_balansiga_va_7e63"
          },
          {
            label: "mafia_soni",
            value: "balanslangan_yashirin_jamoa",
            reason: "bu_parametr_oyinning_keskinligini_belgilaydi_9130"
          },
          {
            label: "komisar_2",
            value: "bor_yoq",
            reason: "komisar_oyinga_tekshiruv_va_yonaltirilgan_7648"
          },
          {
            label: "doktor_2",
            value: "bor_yoq",
            reason: "doktor_tun_fazasiga_qarshi_balans_1fb8"
          },
          {
            label: "tarkib_preview",
            value: "fuqaro_maxsus_rollar",
            reason: "create_sahifada_qolgan_oddiy_fuqarolar_f3a7"
          }
        ]}
        audience={[
          {
            title: "kuzatuvchan_davralar",
            body: "agar_jamoa_mimika_gap_uslubi_dec1"
          },
          {
            title: "kechki_uzunroq_sessiyalar",
            body: "bunkerga_qaraganda_koproq_raund_hissi_ec3b"
          },
          {
            title: "balans_bilan_oynashni_xohlovchilar",
            body: "mafia_soni_komisar_va_doktor_621d"
          }
        ]}
        createHref="/dashboard/create/mafia"
      />
    </>
  );
}
