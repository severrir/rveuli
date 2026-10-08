import { useState } from "react";
import { Download, EllipsisVertical, Plus, Share } from "lucide-react";
import Sheet from "./Sheet.jsx";
import { useInstall } from "../hooks/useInstall.js";

/**
 * Puts the board on the home screen, where a student will actually find it
 * again. Visible until the app is installed: if the browser will let us
 * prompt, one tap does it; otherwise the sheet shows where that browser
 * hides the option, which beats a button that quietly never appears.
 */

const STEPS = {
  ios: [
    { icon: Share, text: "დააჭირე გაზიარების ღილაკს ბრაუზერის ქვედა ზოლში." },
    { icon: Plus, text: "ჩამოდი ქვემოთ და აირჩიე „Add to Home Screen“." },
  ],
  android: [
    { icon: EllipsisVertical, text: "გახსენი ბრაუზერის მენიუ ზემოთ მარჯვნივ." },
    { icon: Download, text: "აირჩიე „Install app“ ან „მთავარ ეკრანზე დამატება“." },
  ],
  desktop: [
    { icon: Download, text: "მისამართის ველის ბოლოს დააჭირე დაყენების ნიშანს." },
    { icon: EllipsisVertical, text: "ან ბრაუზერის მენიუდან აირჩიე „Install“." },
  ],
  firefox: [
    { icon: EllipsisVertical, text: "გახსენი ბრაუზერის მენიუ." },
    { icon: Plus, text: "აირჩიე „მთავარ ეკრანზე დამატება“." },
  ],
};

export default function InstallButton({ onToast }) {
  const { installed, canPrompt, platform, install } = useInstall();
  const [helpOpen, setHelpOpen] = useState(false);

  if (installed) return null;

  async function handleClick() {
    if (canPrompt) {
      const outcome = await install();
      if (outcome === "accepted") onToast?.("რვეული დაყენდა");
      return;
    }
    setHelpOpen(true);
  }

  const steps = STEPS[platform] ?? STEPS.desktop;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="აპლიკაციის დაყენება"
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-ink-600 px-3 text-sm text-paper-2 transition-colors hover:bg-ink-700 hover:text-paper"
      >
        <Download size={16} strokeWidth={1.75} />
        <span className="hidden sm:inline">დაყენება</span>
      </button>

      <Sheet
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="დაყენება მთავარ ეკრანზე"
        description="ორი ნაბიჯი, და რვეული ჩვეულებრივ აპლიკაციასავით გაიხსნება."
      >
        <ol className="flex flex-col gap-4 pb-2">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={i} className="flex gap-3">
                <span className="tnum mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-ink-600 text-sm text-paper-2">
                  {i + 1}
                </span>
                <p className="measure text-base text-paper">
                  <Icon
                    size={17}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className="mr-1.5 inline align-text-bottom text-blue-pen"
                  />
                  {step.text}
                </p>
              </li>
            );
          })}
        </ol>

        <p className="measure border-t border-hairline pt-3 text-sm text-paper-3">
          შემდეგ რვეული მთავარ ეკრანზე გამოჩნდება, სრულ ეკრანზე გაიხსნება და
          ინტერნეტის გარეშეც დაგხვდება ბოლოს ნანახი სია.
        </p>
      </Sheet>
    </>
  );
}
