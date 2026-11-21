import { MapPin, Phone, Mail, Clock, Instagram } from "lucide-react";
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[min(92dvh,880px)] rounded-t-3xl border-border p-0 flex flex-col gap-0 overflow-hidden"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>About Butcher Block Steakhouse</SheetTitle>
          <SheetDescription>Story, hours, contact, and gallery.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <section className="relative h-44 shrink-0">
            <img
              src={heroImage}
              alt="Butcher Block Steakhouse Windhoek"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/20 to-background" />
            <div className="relative flex h-full items-end px-6 pb-4">
              <div>
                <img src={butcherBlockLogo} alt="Butcher Block Steakhouse" className="mb-1.5 h-8 w-auto object-contain" />
                <p className="font-display text-2xl font-bold text-foreground">Butcher Block Steakhouse</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  Steakhouse &bull; Est. 2003 &bull; A cut above the rest
                </p>
              </div>
            </div>
          </section>

          <div className="space-y-8 px-6 pb-10 pt-6">
            <section>
              <h2 className="font-display mb-3 text-xl font-semibold text-foreground">Our Story</h2>
              <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
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
              <h2 className="font-display mb-3 text-xl font-semibold text-foreground">Gallery</h2>
              <div className="grid grid-cols-2 gap-2">
                {[heroImage, gallery1, gallery2, gallery3].map((img, i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-lg">
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
              <h2 className="font-display mb-3 flex items-center gap-2 text-xl font-semibold text-foreground">
                <Clock className="h-5 w-5 text-primary" /> Operating Hours
              </h2>
              <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                {[
                  { day: "Monday – Saturday", hours: "11:30 AM – 10:00 PM" },
                  { day: "Sunday", hours: "11:30 AM – 9:00 PM" },
                ].map((item) => (
                  <div key={item.day} className="flex justify-between text-sm">
                    <span className="text-foreground">{item.day}</span>
                    <span className="text-muted-foreground">{item.hours}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-display mb-3 text-xl font-semibold text-foreground">Contact</h2>
              <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="h-5 w-5 shrink-0 text-primary" />
                  <span className="text-foreground">
                    Am Weinberg Estate, 13 Jan Jonker Road, Klein Windhoek, Windhoek, Namibia
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-5 w-5 shrink-0 text-primary" />
                  <span className="text-foreground">
                    <a href="tel:+264832888000" className="transition-colors hover:text-primary">
                      +264 83 288 8000
                    </a>
                    {" / "}
                    <a href="tel:+264832888001" className="transition-colors hover:text-primary">
                      +264 83 288 8001
                    </a>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-5 w-5 shrink-0 text-primary" />
                  <a
                    href="mailto:windhoek@butcherblock.com.na"
                    className="text-foreground transition-colors hover:text-primary"
                  >
                    windhoek@butcherblock.com.na
                  </a>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Instagram className="h-5 w-5 shrink-0 text-primary" />
                  <a
                    href="https://www.instagram.com/butcherblocknamibia/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground transition-colors hover:text-primary"
                  >
                    @butcherblocknamibia
                  </a>
                </div>
              </div>
            </section>

            <section>
              <h2 className="font-display mb-3 text-xl font-semibold text-foreground">Find Us</h2>
              <div className="aspect-video overflow-hidden rounded-lg border border-border">
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
                className="flex-1 rounded-xl bg-primary py-3.5 text-center text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:scale-[0.97]"
              >
                Book a Table
              </Link>
              <Link
                to="/menu"
                onClick={() => onOpenChange(false)}
                className="flex-1 rounded-xl border border-primary py-3.5 text-center text-sm font-semibold text-primary transition-colors hover:bg-primary/10 active:scale-[0.97]"
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
