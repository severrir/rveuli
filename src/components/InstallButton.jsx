import { useState } from "react";
import { Download, Plus, Share } from "lucide-react";
import Sheet from "./Sheet.jsx";
import { useInstall } from "../hooks/useInstall.js";

/**
 * Puts the board on the home screen, where a student will actually find it
 * again. Hidden once installed, and hidden entirely in browsers that can
 * neither prompt nor be instructed — an offer that leads nowhere is worse
 * than no offer.
 */
export default function InstallButton({ onToast }) {
  const { installed, canPrompt, needsIosInstructions, install } = useInstall();
  const [helpOpen, setHelpOpen] = useState(false);

  if (installed || (!canPrompt && !needsIosInstructions)) return null;

  async function handleClick() {
    if (canPrompt) {
      const outcome = await install();
      if (outcome === "accepted") onToast?.("რვეული დაყენდა");
      return;
    }
    setHelpOpen(true);
  }

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
          <li className="flex gap-3">
            <span className="tnum mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-ink-600 text-sm text-paper-2">
              1
            </span>
            <p className="text-base text-paper">
              დააჭირე გაზიარების ღილაკს
              <Share
                size={16}
                strokeWidth={1.75}
                aria-hidden="true"
                className="mx-1.5 inline align-text-bottom text-blue-pen"
              />
              ბრაუზერის ქვედა ზოლში.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="tnum mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-ink-600 text-sm text-paper-2">
              2
            </span>
            <p className="text-base text-paper">
              ჩამოდი ქვემოთ და აირჩიე
              <Plus
                size={16}
                strokeWidth={2}
                aria-hidden="true"
                className="mx-1.5 inline align-text-bottom text-blue-pen"
              />
              „Add to Home Screen“.
            </p>
          </li>
        </ol>

        <p className="measure border-t border-hairline pt-3 text-sm text-paper-3">
          შემდეგ რვეული მთავარ ეკრანზე გამოჩნდება და სრულ ეკრანზე გაიხსნება.
        </p>
      </Sheet>
    </>
  );
}
