"use client";

import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { TelegramChrome } from "@/components/telegram-chrome";
import { useI18n } from "@/lib/i18n";

type HeroStat = {
  label: string;
  value: string;
};

type StorySection = {
  title: string;
  body: string;
};

type FlowStep = {
  title: string;
  body: string;
};

type ConfigItem = {
  label: string;
  value: string;
  reason: string;
};

type AudienceItem = {
  title: string;
  body: string;
};

type PublicGamePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  heroStats: HeroStat[];
  story: StorySection[];
  flow: FlowStep[];
  configs: ConfigItem[];
  audience: AudienceItem[];
  createHref: string;
};

export function PublicGamePage({
  eyebrow,
  title,
  description,
  image,
  imageAlt,
  heroStats,
  story,
  flow,
  configs,
  audience,
  createHref,
}: PublicGamePageProps) {
  const { t } = useI18n();
  const loginHref =
    `/login?redirect=${encodeURIComponent(createHref)}` as Route;

  return (
    <main className="min-h-screen bg-bg-base text-ink-primary">
      <TelegramChrome backHref="/" />
      <header className="sticky top-0 z-30 border-b border-line-subtle bg-bg-base/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href={"/" as Route} className="flex items-center gap-3">
            <BrandMark size={40} />
            <div className="leading-tight">
              <p className="text-sm font-semibold sm:text-base">Jamoaviy.uz</p>
              <p className="text-[10px] uppercase tracking-wider text-ink-muted sm:text-xs">
                {t("jamoaviy_oyinlar")}
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher variant="select" />
            <Link
              href={loginHref}
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-brand px-4 text-xs font-semibold text-bg-base transition active:scale-[0.98] sm:text-sm"
            >
              {t("login_qilib_yaratish")}
            </Link>
          </div>
        </div>
      </header>

      <section className="border-b border-line-subtle">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14 lg:px-8 lg:py-20">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-brand">
              {t(eyebrow)}
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              {t(title)}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-ink-secondary sm:text-base sm:leading-8">
              {t(description)}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href={loginHref}
                className="inline-flex h-14 items-center justify-center rounded-2xl bg-brand px-6 text-base font-semibold text-bg-base transition active:scale-[0.98]"
              >
                {t("oyin_yaratish")}
              </Link>
              <Link
                href={"/" as Route}
                className="inline-flex h-14 items-center justify-center rounded-2xl border border-line-strong bg-bg-surface px-6 text-base font-semibold text-ink-primary transition active:scale-[0.98]"
              >
                {t("landingga_qaytish")}
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {heroStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-line-subtle bg-bg-surface p-4"
                >
                  <p className="text-lg font-bold text-ink-primary">
                    {t(item.value)}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-ink-muted sm:text-xs">
                    {t(item.label)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-line-subtle bg-bg-surface shadow-pop">
            <div className="relative aspect-[16/11] w-full">
              <Image
                src={image}
                alt={t(imageAlt)}
                fill
                sizes="(max-width: 1024px) 100vw, 560px"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg-base/80 via-bg-base/10 to-transparent" />
            </div>
            <div className="grid gap-3 p-5 sm:p-6">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand">
                {t("nima_uchun_bu_sahifa_bor")}
              </p>
              <p className="text-sm leading-7 text-ink-secondary">
                {t("bu_yerda_oyinning_mantigi_kimlar_aa3f")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line-subtle">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand">
              {t("bolim_maqsadi")}
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              {t("oyin_nimaga_qurilganini_oldindan_bilib_e22e")}
            </h2>
            <p className="mt-3 text-sm leading-7 text-ink-secondary sm:text-base">
              {t("har_bir_blok_bir_savolga_a698")}
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {story.map((item) => (
              <article
                key={item.title}
                className="rounded-3xl border border-line-subtle bg-bg-surface p-5"
              >
                <p className="text-base font-semibold">{t(item.title)}</p>
                <p className="mt-3 text-sm leading-7 text-ink-secondary">
                  {t(item.body)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line-subtle">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand">
              {t("oyin_oqimi")}
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              {t("raundlar_qanday_ishlashini_bilish_uchun")}
            </h2>
            <p className="mt-3 text-sm leading-7 text-ink-secondary sm:text-base">
              {t("bu_bolim_host_va_oyinchilar_0bd5")}
            </p>
          </div>

          <ol className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {flow.map((step, index) => (
              <li
                key={step.title}
                className="rounded-3xl border border-line-subtle bg-bg-surface p-5"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft font-mono text-sm font-semibold text-brand">
                  {index + 1}
                </span>
                <p className="mt-4 text-base font-semibold">{t(step.title)}</p>
                <p className="mt-2 text-sm leading-7 text-ink-secondary">
                  {t(step.body)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-line-subtle">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand">
              {t("yaratish_configlari")}
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              {t("har_bir_sozlama_nimani_boshqaradi")}
            </h2>
            <p className="mt-3 text-sm leading-7 text-ink-secondary sm:text-base">
              {t("login_qilgandan_keyin_aynan_shu_bf72")}
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {configs.map((item) => (
              <article
                key={item.label}
                className="rounded-3xl border border-line-subtle bg-bg-surface p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.22em] text-ink-muted">
                      {t("config")}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold">
                      {t(item.label)}
                    </h3>
                  </div>
                  <span className="rounded-full border border-brand/25 bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                    {t(item.value)}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-ink-secondary">
                  {t(item.reason)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line-subtle">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand">
              {t("kimlar_uchun")}
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              {t("togri_davrani_tanlash_uchun_qisqa_073c")}
            </h2>
            <p className="mt-3 text-sm leading-7 text-ink-secondary sm:text-base">
              {t("bu_bolim_oyinni_qaysi_jamoa_4677")}
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {audience.map((item) => (
              <article
                key={item.title}
                className="rounded-3xl border border-line-subtle bg-bg-surface p-5"
              >
                <h3 className="text-base font-semibold">{t(item.title)}</h3>
                <p className="mt-3 text-sm leading-7 text-ink-secondary">
                  {t(item.body)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="rounded-[2rem] border border-line-subtle bg-gradient-to-br from-brand/15 via-bg-surface to-bg-surface p-6 sm:p-10 lg:p-14">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-brand">
                  {t("keyingi_qadam")}
                </p>
                <h2 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
                  {t("jamoani_yiging_va_room_ochishni_aa08")}
                </h2>
                <p className="mt-3 text-sm leading-7 text-ink-secondary sm:text-base">
                  {t("yaratish_tugmasi_login_sahifasiga_olib_boradi")}
                </p>
              </div>
              <div className="grid gap-3">
                <Link
                  href={loginHref}
                  className="inline-flex h-14 items-center justify-center rounded-2xl bg-brand px-6 text-base font-semibold text-bg-base transition active:scale-[0.98]"
                >
                  {t("login_qilib_yaratish")}
                </Link>
                <Link
                  href={"/" as Route}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-line-strong bg-bg-surface px-6 text-sm font-semibold text-ink-primary transition active:scale-[0.98]"
                >
                  {t("boshqa_oyinlarni_korish")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
