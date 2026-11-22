import { useRef } from "react";
import { MapPin, Phone, Mail, Clock, Instagram, X } from "lucide-react";
import { Link } from "react-router-dom";
import gallery1 from "@/assets/gallery-1.jpg";
import gallery2 from "@/assets/gallery-2.jpg";
import gallery3 from "@/assets/gallery-3.jpg";
import heroImage from "@/assets/hero-restaurant.jpg";
import butcherBlockLogo from "@/assets/butcher-block-logo.png";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type AboutSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AboutSheet({ open, onOpenChange }: AboutSheetProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((scrollRef.current?.scrollTop ?? 0) <= 2) {
      dragStartY.current = e.touches[0]?.clientY ?? null;
    } else {
      dragStartY.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? dragStartY.current;
    if (endY - dragStartY.current > 72) {
      onOpenChange(false);
    }
    dragStartY.current = null;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onEscapeKeyDown={() => onOpenChange(false)}
        className="flex max-h-[min(92dvh,880px)] flex-col gap-0 overflow-hidden rounded-t-[28px] border-t border-white/10 bg-[#121212] p-0 text-white [&>button.absolute]:hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>About Butcher Block Steakhouse</SheetTitle>
          <SheetDescription>Story, hours, contact, and gallery.</SheetDescription>
        </SheetHeader>

        {/* iOS grabber + high-contrast 44x44 close control */}
        <div
          className="relative flex shrink-0 items-center justify-center bg-[#121212] py-2.5"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="h-1 w-10 rounded-full bg-white/25" aria-hidden="true" />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close about sheet"
            className="absolute right-3 top-2.5 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-[#242424]/90 text-white backdrop-blur-md transition-colors hover:bg-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5A1F]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div
          ref={scrollRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
        >
          <section className="relative h-44 shrink-0">
            <img
              src={heroImage}
              alt="Butcher Block Steakhouse Windhoek"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#121212]/25 to-[#121212]" />
            <div className="relative flex h-full items-end px-6 pb-4">
              <div>
                <img src={butcherBlockLogo} alt="Butcher Block Steakhouse" className="mb-1.5 h-8 w-auto object-contain" />
                <p className="font-display text-2xl font-bold text-white">Butcher Block Steakhouse</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-[#A3A3A3]">
                  Steakhouse &bull; Est. 2003 &bull; A cut above the rest
                </p>
              </div>
            </div>
          </section>

          <div className="space-y-8 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] pt-6">
            <section>
              <h2 className="font-display mb-3 text-xl font-semibold text-white">Our Story</h2>
              <div className="space-y-3 text-sm leading-relaxed text-[#A3A3A3]">
                <p>
                  Established in 2003 and situated at the prestigious Am Weinberg Estate in Klein Windhoek, Butcher
                  Block Steakhouse is where 100% Namibian, grass-fed, wet-aged A-grade beef meets warm, upmarket
                  hospitality.
                </p>
                <p>
                  Our cuts are wet-aged for a minimum of 21 days, flame-grilled over charcoal embers, and served on
                  wooden boards with hot plates — paired with curated South African wines from our transparent glass
                  cellar and classic craft cocktails.
                </p>
                <p>
                  Blending rich leather, natural wood, and a lively yet refined atmosphere, we are the home of signature
                  Tomahawk steaks, Tuesday Ladies&apos; Night, and Wednesday Men&apos;s Night.
                </p>
              </div>
            </section>

            <section>
              <h2 className="font-display mb-3 text-xl font-semibold text-white">Gallery</h2>
              <div className="grid grid-cols-2 gap-2">
                {[heroImage, gallery1, gallery2, gallery3].map((img, i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-2xl border border-white/10">
                    <img
                      src={img}
                      alt={`Butcher Block Steakhouse gallery ${i + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-display mb-3 flex items-center gap-2 text-xl font-semibold text-white">
                <Clock className="h-5 w-5 text-[#FF5A1F]" aria-hidden="true" /> Operating Hours
              </h2>
              <div className="space-y-2 rounded-2xl border border-white/10 bg-[#242424] p-4">
                {[
                  { day: "Monday – Saturday", hours: "11:30 AM – 10:00 PM" },
                  { day: "Sunday", hours: "11:30 AM – 9:00 PM" },
                ].map((item) => (
                  <div key={item.day} className="flex justify-between text-sm">
                    <span className="text-white">{item.day}</span>
                    <span className="text-[#A3A3A3]">{item.hours}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-display mb-3 text-xl font-semibold text-white">Contact</h2>
              <div className="space-y-3 rounded-2xl border border-white/10 bg-[#242424] p-4">
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-5 w-5 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                  <span className="text-white">
                    Am Weinberg Estate, 13 Jan Jonker Road, Klein Windhoek, Windhoek, Namibia
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-5 w-5 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                  <span className="text-white">
                    <a href="tel:+264832888000" className="transition-colors hover:text-[#FF5A1F]">
                      +264 83 288 8000
                    </a>
                    {" / "}
                    <a href="tel:+264832888001" className="transition-colors hover:text-[#FF5A1F]">
                      +264 83 288 8001
                    </a>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-5 w-5 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                  <a
                    href="mailto:windhoek@butcherblock.com.na"
                    className="text-white transition-colors hover:text-[#FF5A1F]"
                  >
                    windhoek@butcherblock.com.na
                  </a>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Instagram className="h-5 w-5 shrink-0 text-[#FF5A1F]" aria-hidden="true" />
                  <a
                    href="https://www.instagram.com/butcherblocknamibia/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white transition-colors hover:text-[#FF5A1F]"
                  >
                    @butcherblocknamibia
                  </a>
                </div>
              </div>
            </section>

            <section>
              <h2 className="font-display mb-3 text-xl font-semibold text-white">Find Us</h2>
              <div className="aspect-video overflow-hidden rounded-2xl border border-white/10">
                <iframe
                  src="https://maps.google.com/maps?q=Butcher+Block+Steakhouse+Am+Weinberg+Estate+13+Jan+Jonker+Street+Windhoek+Namibia&z=17&hl=en&ie=UTF8&iwloc=&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Butcher Block Steakhouse location"
                />
              </div>
            </section>

            <div className="flex gap-3">
              <Link
                to="/booking"
                onClick={() => onOpenChange(false)}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-full bg-[#FF5A1F] text-center text-sm font-bold text-white transition-colors hover:bg-[#E84D15] active:scale-[0.98]"
              >
                Book a Table
              </Link>
              <Link
                to="/menu"
                onClick={() => onOpenChange(false)}
                className="flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-[#FF5A1F] text-center text-sm font-bold text-[#FF5A1F] transition-colors hover:bg-[#FF5A1F]/10 active:scale-[0.98]"
              >
                View Menu
              </Link>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
