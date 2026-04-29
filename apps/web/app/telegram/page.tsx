import { TelegramAuthGate } from "@/components/telegram-auth-gate";

export const metadata = {
  title: "Telegram WebApp",
  // Don't index this entry path — it's a Mini App handoff, not content.
  robots: { index: false, follow: false }
};

// Dedicated entry the BotFather Main App URL points at. Browser visitors
// are bounced to "/" automatically; Telegram WebApp users land here, see
// the loader, and are routed onward (start_param room or home dashboard).
export default function TelegramEntryPage() {
  return <TelegramAuthGate />;
}
