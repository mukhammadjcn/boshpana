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
        eyebrow="Bunker · Apokalipsis stol o'yini"
        title="Bunker — kim omon qoladi?"
        description="Bunker jamoaviy muzokara, strategiya va bosim ostida qaror chiqarishga qurilgan o'yin. Har bir o'yinchi yashirin atributlar bilan kiradi, joy esa hammaga yetmaydi. Jamoa kim bunkerda qolishini asoslab hal qiladi."
        image="/bunkerbanner.webp"
        imageAlt="Bunker o'yini banneri"
        heroStats={[
          { label: "o'yinchi", value: "3-16" },
          { label: "davomiylik", value: "30-60 daq" },
          { label: "format", value: "Pitch + vote" },
          { label: "platforma", value: "Telegram" }
        ]}
        story={[
          {
            title: "Nega o'ynaladi",
            body: "Bu o'yin odamning foydasi, riski va ishontirish qobiliyatini bir stol atrofida sinaydi. Har davrada kim jamoa uchun ko'proq kerakligini bahslashasiz."
          },
          {
            title: "Asosiy drama",
            body: "Hammaning kartasi to'liq ochilmaydi. Qaysi atributni qachon ko'rsatish strategiya bo'lgani uchun yolg'on, noqulay fakt va kuchli pitch bir joyga to'qnashadi."
          },
          {
            title: "Host uchun foyda",
            body: "Room yaratish juda tez: faqat yakuniy g'oliblar soni va mavzuni tanlaysiz. Qolgan oqim taymerlar, navbatlar va ovozlar bilan tizim tomonidan yuritiladi."
          }
        ]}
        flow={[
          {
            title: "Falokat tanishtiriladi",
            body: "Jamoa bir xil krizisga tushadi va bunkerda nechta joy borligi aniq bo'ladi. Shu yerning o'zi butun bahsning kontekstini belgilaydi."
          },
          {
            title: "Atributlar bosqichma-bosqich ochiladi",
            body: "Kasb, sog'liq, xarakter, skill, bagaj va fakt kabi kartalar birdaniga emas, raund davomida ochiladi. Bu keskinlikni ushlab turadi."
          },
          {
            title: "Pitch va savol-javob",
            body: "Har kim o'zini kerakli odam sifatida ko'rsatadi. Aynan shu bosqich ijtimoiy o'yin, kulgili vaziyat va manipulyatsiya uchun xizmat qiladi."
          },
          {
            title: "Ovoz va chiqarish",
            body: "Raund oxirida bitta yoki bir nechta o'yinchi chetlatiladi. Tirik qolganlar soni siz tanlagan g'oliblar limitiga tushganda o'yin tugaydi."
          }
        ]}
        configs={[
          {
            label: "Nickname",
            value: "Host nomi",
            reason: "Bu sozlama lobbida va o'yin ichida sizni ko'rsatish uchun kerak. Jamoa hostni va room egasini tez tanib oladi."
          },
          {
            label: "O'yin nechta odam qolganda tugaydi?",
            value: "1 / 2 / 3 kishi",
            reason: "Bu eng muhim bunker configi. 1 kishi qolganda eng keskin klassik rejim bo'ladi, 2 yoki 3 kishi esa yumshoqroq va tezroq tugaydigan davralar uchun mos."
          },
          {
            label: "Mavzu",
            value: "Oddiy yoki 18+",
            reason: "Kartalar va vaziyatlar kayfiyatini boshqaradi. Davrada notanishlar yoki yumshoqroq format bo'lsa oddiy mavzu qulay, yaqin do'stlar uchun 18+ yanada erkinroq bo'lishi mumkin."
          },
          {
            label: "Lobby havolasi",
            value: "Room code + share link",
            reason: "Room ochilgach tizim kod va ulashish havolasini beradi. Bu sozlama emasdek ko'rinsa ham, jamoani tez yig'ish uchun yaratish oqimining eng amaliy qismi shu."
          }
        ]}
        audience={[
          {
            title: "Bahslashishni yoqtiradigan davralar",
            body: "Agar jamoa bir-birini gap bilan bosishni, kulgili himoyalar qilishni va ijtimoiy bosimni yoqtirsa, Bunker juda tez ochiladi."
          },
          {
            title: "Katta guruhlar",
            body: "3 dan 16 kishigacha ishlagani uchun ofis, mehmon, sinfdosh yoki katta do'stlar davrasida yaxshi ketadi."
          },
          {
            title: "Hostga yengil format kerak bo'lsa",
            body: "Murakkab role assignment yoki tun fazalari yo'q. Shu sabab ilk marta room ochayotganlar uchun ham boshqarish oson."
          }
        ]}
        createHref="/dashboard/create/bunker"
      />
    </>
  );
}
