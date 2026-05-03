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
        eyebrow="Mafia · Kun va tun strategiyasi"
        title="Mafia — kim xiyonatkor?"
        description="Mafia yashirin rollar, kuzatuv va jamoaviy shubha ustiga qurilgan klassik ijtimoiy o'yin. Kunduzi hamma gapiradi, tunda esa roli borlar maxfiy qaror qiladi. Kimga ishonish va qaysi configni tanlash butun tempni o'zgartiradi."
        image="/mafiabanner.webp"
        imageAlt="Mafia o'yini banneri"
        heroStats={[
          { label: "o'yinchi", value: "4-16" },
          { label: "davomiylik", value: "30-45 daq" },
          { label: "format", value: "Night + day" },
          { label: "platforma", value: "Telegram" }
        ]}
        story={[
          {
            title: "Nega o'ynaladi",
            body: "Mafia kuzatish, yolg'onni ushlash va odamlarning gapirish uslubini tahlil qilishni sevuvchi jamoalar uchun juda kuchli format."
          },
          {
            title: "Asosiy drama",
            body: "Bir xil gapni ikki xil rol butunlay boshqacha maqsadda aytishi mumkin. Tunda bo'lgan voqealarni kunduzi kim qanday talqin qilishi g'olibni belgilaydi."
          },
          {
            title: "Host uchun foyda",
            body: "Role composition oldindan ko'rinadi: mafia soni, komisar va doktor bor-yo'qligi aniq. Shu sabab siz davraga mos balansni room ochishdan oldin tuzasiz."
          }
        ]}
        flow={[
          {
            title: "Role taqsimoti",
            body: "Room ichidagi har bir o'yinchi yashirin rol oladi. Bu bosqich o'yinning balansini belgilaydi va jamoa kim ekanini bilmagan holda start beradi."
          },
          {
            title: "Tun fazasi",
            body: "Mafia nishon tanlaydi, komisar tekshiradi yoki zarba beradi, doktor esa qutqarishga urinadi. Bu bo'lim maxfiy ma'lumot va keskinlik yaratish uchun kerak."
          },
          {
            title: "Kun muhokamasi",
            body: "Tun natijasidan keyin hamma o'z versiyasini aytadi. Kuzatuv, psixologiya va noto'g'ri yo'naltirish aynan shu yerda ishlaydi."
          },
          {
            title: "Ovoz bilan chetlatish",
            body: "Jamoa shubhali odamni chiqaradi. Mafia tirik aholi soniga yetib olsa g'alaba qiladi, aks holda shahar taraf yutadi."
          }
        ]}
        configs={[
          {
            label: "Nickname",
            value: "Host nomi",
            reason: "Bu room egasini ko'rsatadi va lobbida jamoa kimga ergashishini aniq qiladi. Ayniqsa katta guruhda muhim."
          },
          {
            label: "Maks o'yinchi",
            value: "4 dan 16 gacha",
            reason: "Davra kattaligi role balansiga va o'yin davomiyligiga ta'sir qiladi. Odam ko'paygan sari muhokama kengayadi, lekin partiya cho'zilishi ham mumkin."
          },
          {
            label: "Mafia soni",
            value: "Balanslangan yashirin jamoa",
            reason: "Bu parametr o'yinning keskinligini belgilaydi. Kam mafia ehtiyotkor deduksiya beradi, ko'proq mafia esa shahar tomoni uchun xavfni oshiradi."
          },
          {
            label: "Komisar",
            value: "Bor / yo'q",
            reason: "Komisar o'yinga tekshiruv va yo'naltirilgan shubha qo'shadi. Yangi davralarda bu rol muhokamani tartibga solishga yordam beradi."
          },
          {
            label: "Doktor",
            value: "Bor / yo'q",
            reason: "Doktor tun fazasiga qarshi balans beradi. Agar partiya juda keskin bo'lib ketmasin desangiz, doktorni yoqib qo'yish foydali."
          },
          {
            label: "Tarkib preview",
            value: "Fuqaro + maxsus rollar",
            reason: "Create sahifada qolgan oddiy fuqarolar soni avtomatik hisoblanadi. Bu noto'g'ri tarkib tuzib qo'ymaslik uchun ko'rsatib turiladi."
          }
        ]}
        audience={[
          {
            title: "Kuzatuvchan davralar",
            body: "Agar jamoa mimika, gap uslubi va nozik tafsilotlardan shubha chiqarishni yoqtirsa, Mafia juda yaxshi ishlaydi."
          },
          {
            title: "Kechki uzunroq sessiyalar",
            body: "Bunkerga qaraganda ko'proq raund hissi beradi. Shu sabab bir o'yinga chuqurroq kirishni xohlaydigan guruhlarga mos."
          },
          {
            title: "Balans bilan o'ynashni xohlovchilar",
            body: "Mafia soni, komisar va doktor kabi configlar tufayli host davra tajribasiga qarab o'yinni nozik sozlashi mumkin."
          }
        ]}
        createHref="/dashboard/create/mafia"
      />
    </>
  );
}
