"use client";

import type { Route } from "next";
import { BrandMark } from "@/components/brand-mark";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getAuthToken } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";

const GAMES = [
  {
    title: "Bunker",
    body: "Apokalipsisdan keyin bunkerga kim qolishini pitch va ovoz bilan hal qiladigan ijtimoiy o'yin.",
    meta: "3-16 o'yinchi · 30-60 daqiqa",
    href: "/games/bunker" as Route,
    image: "/bunkerbanner.webp",
    cta: "Bunker sahifasini ochish"
  },
  {
    title: "Mafia",
    body: "Kun va tun rejimida yashirin rollar bilan xiyonatkorlarni topishga qurilgan klassik strategik davra o'yini.",
    meta: "4-16 o'yinchi · 30-45 daqiqa",
    href: "/games/mafia" as Route,
    image: "/mafiabanner.webp",
    cta: "Mafia sahifasini ochish"
  },
];

const STEPS = [
  {
    n: 1,
    title: "O'yinni tanlaysiz",
    body: "Landing ichida qaysi format sizning davrangizga mosligini ko'rasiz va alohida route ichida batafsil ma'lumotni ochasiz.",
  },
  {
    n: 2,
    title: "Configlarni oldindan ko'rasiz",
    body: "Har bir game page ichida create vaqtida chiqadigan asosiy sozlamalar va ularning nima uchun kerakligi yozilgan bo'ladi.",
  },
  {
    n: 3,
    title: "Telegram orqali kirasiz",
    body: "Yaratish tugmasi login sahifasiga olib boradi. Avtorizatsiyadan keyin siz o'sha o'yinning create sahifasiga redirect bo'lasiz.",
  },
  {
    n: 4,
    title: "Roomni ishga tushirasiz",
    body: "Host room yaratadi, jamoaga havolani yuboradi va barcha o'yinchilar bir joydan jonli o'yinga kiradi.",
  },
];

const BRAND_POINTS = [
  {
    title: "Platforma nima uchun bor",
    body: "Jamoaviy.uz birgalikda o'ynaladigan o'yinlarni bitta qulay kirish nuqtasiga yig'adi, shunda har safar alohida bot yoki alohida sayt qidirmaysiz.",
  },
  {
    title: "Game route nima uchun bor",
    body: "Har bir o'yin uchun alohida route userni chalg'itmaydi: qoidalar, kimlar uchunligi va create configlari bir joyda turadi.",
  },
  {
    title: "Login redirect nima uchun kerak",
    body: "Public landing hamma uchun ochiq, lekin room yaratish host identifikatsiyasi bilan bog'liq. Shu sabab create bosilganda login qilinadi va keyin kerakli create page ochiladi.",
  },
];

export function HomePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);
  const loginHref = "/login" as Route;

  useEffect(() => {
    if (getAuthToken()) {
      setRedirecting(true);
      router.replace("/dashboard" as Route);
    }
  }, [router]);

  if (redirecting) {
    return (
      <main className="grid min-h-screen place-items-center bg-bg-base text-ink-secondary">
        <div className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
          {t("Yuklanmoqda...")}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <header className="sticky top-0 z-30 border-b border-line-subtle bg-bg-base/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandMark size={40} />
            <div className="leading-tight">
              <p className="text-sm font-semibold sm:text-base">
                Jamoaviy.uz
              </p>
              <p className="text-[10px] uppercase tracking-wider text-ink-muted sm:text-xs">
                {t("Jamoaviy o'yinlar")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="select" />
            <BotCta
              href={loginHref}
              label={t("Telegramda ochish")}
              variant="primary"
              size="sm"
            />
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-line-subtle">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_55%_at_50%_0%,rgba(255,107,46,0.18),transparent)]" />
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand">
              {t("Telegram party games platform")}
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              <span className="text-brand">Jamoaviy.uz</span>{" "}
              {t("ichida do'stlar bilan o'ynaladigan o'yinlar jamlangan")}
            </h1>
            <p className="mt-4 text-base leading-7 text-ink-secondary sm:text-lg sm:leading-8">
              {t(
                "Bu yerda Bunker va Mafia kabi jamoaviy o'yinlar alohida routelar bilan taqdim etiladi. Har bir route ichida o'yin haqida kengaytirilgan ma'lumot, create configlari va ularning nima uchun kerakligi yozilgan bo'ladi."
              )}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <p className="text-xs text-ink-muted sm:text-sm">
                {t(
                  "O'yin yaratish uchun Telegram orqali kirasiz, tanlash esa public landing ichida ham ochiq"
                )}
              </p>
            </div>

            <ul className="mt-8 grid grid-cols-3 gap-3 text-center text-xs sm:text-sm">
              <Stat value="2+" label={t("o'yin")} />
              <Stat value="Telegram" label={t("login")} />
              <Stat value="Mobile" label={t("first")} />
            </ul>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-3xl border border-line-subtle bg-bg-surface shadow-pop">
              <div className="relative aspect-[16/8.5] w-full">
                <Image
                  src="/banner.png"
                  alt="Jamoaviy.uz banneri"
                  fill
                  sizes="(max-width: 1024px) 100vw, 560px"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-bg-base/80 via-bg-base/20 to-transparent" />
              </div>
              <div className="grid gap-3 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <BrandMark size={52} />
                  <div>
                    <p className="text-sm font-semibold">Jamoaviy.uz</p>
                    <p className="text-xs text-ink-muted">
                      {t("Bunker, Mafia va yana ko'proq o'yinlar uchun kirish nuqtasi")}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 rounded-2xl border border-line-subtle bg-bg-base/60 p-4 text-sm text-ink-secondary">
                  <p>{t("Bunker route ichida pitch, vote va survivor flow tushuntiriladi.")}</p>
                  <p>{t("Mafia route ichida role balance, tun-kun fazalari va create tarkibi ko'rsatiladi.")}</p>
                  <p>{t("Har ikki sahifadagi O'yin yaratish tugmasi login bilan kerakli create page'ga olib boradi.")}</p>
                </div>
              </div>
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-6 -right-6 -z-10 h-32 w-32 rounded-full bg-brand/30 blur-3xl"
            />
          </div>
        </div>
      </section>

      <section className="border-b border-line-subtle">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              {t("O'yin routelari")}
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              {t("Landing ichidan ikki yangi public kirish nuqtasi")}
            </h2>
            <p className="mt-3 text-sm text-ink-secondary sm:text-base">
              {t(
                "Har bir karta alohida game page'ga olib boradi. Ichkarida qoidalar, maqsad, configlar va login redirect bilan create tugmasi bor."
              )}
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {GAMES.map((game) => (
              <Link
                key={game.title}
                href={game.href}
                className="overflow-hidden rounded-3xl border border-line-subtle bg-bg-surface transition active:scale-[0.99]"
              >
                <div className="relative aspect-[16/9] w-full">
                  <Image
                    src={game.image}
                    alt={game.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 520px"
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                </div>
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xl font-semibold">{game.title}</p>
                      <p className="mt-2 text-sm leading-7 text-ink-secondary">
                        {t(game.body)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-brand/25 bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                      {t("Yangi o'yin")}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-ink-muted sm:text-sm">
                    <span>{t(game.meta)}</span>
                    <span className="font-semibold text-brand">{t(game.cta)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line-subtle">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              {t("Platforma qadri")}
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              {t("Nima uchun aynan shu struktura tanlandi")}
            </h2>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BRAND_POINTS.map((f) => (
              <li
                key={f.title}
                className="rounded-2xl border border-line-subtle bg-bg-surface p-5"
              >
                <p className="mt-3 text-base font-semibold">{t(f.title)}</p>
                <p className="mt-2 text-sm leading-6 text-ink-secondary">
                  {t(f.body)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-b border-line-subtle">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-wider text-brand">
              {t("Qanday ishlaydi")}
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              {t("User flow 4 qadamda aniq ko'rinadi")}
            </h2>
            <p className="mt-3 text-sm text-ink-secondary sm:text-base">
              {t(
                "Bu bo'lim yangi mehmon uchun saytdagi harakat yo'lini soddalashtiradi: tanlash, tushunish, login qilish va room yaratish."
              )}
            </p>
          </div>
          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((a) => (
              <li
                key={a.n}
                className="rounded-2xl border border-line-subtle bg-bg-surface p-5"
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft font-mono text-sm font-semibold text-brand">
                  {a.n}
                </span>
                <p className="mt-3 text-sm font-semibold sm:text-base">
                  {t(a.title)}
                </p>
                <p className="mt-2 text-sm leading-6 text-ink-secondary">
                  {t(a.body)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="rounded-3xl border border-line-subtle bg-gradient-to-br from-brand/15 via-bg-surface to-bg-surface p-6 sm:p-10 lg:p-14">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
              <div>
                <h2 className="text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
                  {t("Do'stlar bilan birga")}{" "}
                  <span className="text-brand">{t("qaysi o'yindan boshlaysiz?")}</span>
                </h2>
                <p className="mt-3 text-sm leading-7 text-ink-secondary sm:text-base">
                  {t(
                    "Public landing ichidan o'yinni tanlang, route ichida configlarni ko'ring va create tugmasi orqali login qilib to'g'ridan-to'g'ri room yaratishga o'ting."
                  )}
                </p>
              </div>
              <div className="grid gap-3">
                <BotCta
                  href={loginHref}
                  label={t("Telegramda boshlash")}
                  variant="primary"
                  size="lg"
                />
                <p className="text-center text-xs text-ink-muted">
                  {t("Jamoaviy.uz ichida host yaratadi, jamoa esa havola bilan kiradi.")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-line-subtle">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Jamoaviy.uz</p>
          <p>{t("Bunker · Mafia · Mobile-first · Telegram orqali")}</p>
        </div>
      </footer>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <li className="rounded-xl border border-line-subtle bg-bg-surface px-3 py-2.5">
      <p className="text-base font-bold sm:text-lg">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-ink-muted sm:text-xs">
        {label}
      </p>
    </li>
  );
}

function BotCta({
  href,
  label,
  variant,
  size,
}: {
  href: Route;
  label: string;
  variant: "primary" | "secondary";
  size: "sm" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "h-14 px-6 text-base sm:h-14"
      : "h-10 px-4 text-xs sm:text-sm";
  const variantClass =
    variant === "primary"
      ? "bg-brand text-bg-base"
      : "border border-line-strong bg-bg-surface text-ink-primary";
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.98] ${sizeClass} ${variantClass}`}
    >
      <span aria-hidden>✈</span>
      {label}
    </Link>
  );
}
